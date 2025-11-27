// Content script for text rewriting and summarization
let originalTexts = new Map();
let isRewritten = false;
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 10;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'rewritePage') {
        rewritePageContent(request.apiKey, request.targetLevel, request.language)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    if (request.action === 'summarizePage') {
        summarizePageContent(request.apiKey, request.targetLevel, request.language)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    if (request.action === 'resetPage') {
        resetPageContent();
        sendResponse({ success: true });
    }
    
    if (request.action === 'updateProgress') {
        sendResponse({ success: true });
    }
});

// ========== REWRITE PAGE FUNCTIONALITY ==========

// Main function to rewrite page content
async function rewritePageContent(apiKey, targetLevel, language = 'en') {
    try {
        // Store original texts if not already stored
        if (!isRewritten) {
            storeOriginalTexts(language);
        }
        
        chrome.runtime.sendMessage({ action: 'progressUpdate', progress: 10 });
        
        // Process text elements in parallel with concurrency control
        await rewriteTextElementsParallel(targetLevel, apiKey, language);
        
        isRewritten = true;
        chrome.runtime.sendMessage({ action: 'progressUpdate', progress: 100 });
        
        return { success: true, elementsRewritten: originalTexts.size };
        
    } catch (error) {
        console.error('Content rewriting error:', error);
        return { success: false, error: error.message };
    }
}

// Parallel processing with concurrency control
async function rewriteTextElementsParallel(targetLevel, apiKey, language) {
    const items = Array.from(originalTexts.entries());
    const totalElements = items.length;
    let processedElements = 0;
    
    // Process in chunks to control concurrency
    const chunkSize = MAX_CONCURRENT_REQUESTS;
    const chunks = [];
    
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    
    for (const chunk of chunks) {
        // Process current chunk in parallel
        const promises = chunk.map(async ([index, item]) => {
            const originalText = item.originalText;
            
            if (originalText.trim().length > 10) {
                try {
                    const isTitle = item.element.tagName.match(/^H[1-6]$/i);
                    const rewrittenText = await rewriteTextWithOpenAI(originalText, targetLevel, apiKey, isTitle, language);
                    
                    // Update DOM - this is thread-safe as it's in the main thread
                    replaceElementTextSimple(item.element, rewrittenText);
                    
                } catch (error) {
                    console.error(`Error rewriting element ${index}:`, error);
                    // Keep original text on error
                }
            }
            
            // Update progress
            processedElements++;
            const progress = 10 + Math.floor((processedElements / totalElements) * 80);
            chrome.runtime.sendMessage({ action: 'progressUpdate', progress: progress });
        });
        
        // Wait for current chunk to complete before starting next
        await Promise.allSettled(promises);
        
        // Small delay between chunks to avoid overwhelming the API
        if (chunks.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}

// Store original text content with language detection
function storeOriginalTexts(language) {
    originalTexts.clear();
    
    // More selective element targeting to avoid random blocks
    const textElements = document.querySelectorAll(`
        p, h1, h2, h3, h4, h5, h6,
        article p, article h1, article h2, article h3,
        section p, section h1, section h2, section h3,
        .content p, .content h1, .content h2, .content h3,
        .article p, .article h1, .article h2, .article h3,
        .post p, .post h1, .post h2, .post h3,
        [role="article"] p, [role="article"] h1, [role="article"] h2,
        main p, main h1, main h2, main h3
    `);
    
    let index = 0;
    
    textElements.forEach((element) => {
        // Language-specific filtering
        if (shouldProcessElementForLanguage(element, language) &&
            element.textContent && 
            element.textContent.trim().length > 25 && 
            isVisible(element) &&
            !isInNav(element) &&
            !isInteractive(element)) {
            
            // Skip elements that are likely to be meta content or random blocks
            if (isRandomTextBlock(element)) {
                return;
            }
            
            originalTexts.set(index, {
                element: element,
                originalText: element.textContent,
                originalHTML: element.innerHTML,
                tagName: element.tagName.toLowerCase()
            });
            index++;
        }
    });
    
    console.log(`Stored ${originalTexts.size} text elements for rewriting in ${language}`);
}

// Language-specific element filtering
function shouldProcessElementForLanguage(element, language) {
    const text = element.textContent.trim();
    
    if (language === 'ru') {
        // For Russian mode, prefer Cyrillic text
        const cyrillicRatio = (text.match(/[а-яА-ЯёЁ]/g) || []).length / text.length;
        return cyrillicRatio > 0.3; // At least 30% Cyrillic characters
    } else {
        // For English mode, prefer Latin text
        const latinRatio = (text.match(/[a-zA-Z]/g) || []).length / text.length;
        return latinRatio > 0.6; // At least 60% Latin characters
    }
}

// Enhanced text rewriting with bilingual support
async function rewriteTextWithOpenAI(text, targetLevel, apiKey, isTitle = false, language = 'en') {
    const cleanText = text.trim().replace(/\s+/g, ' ').substring(0, 2000);
    
    const temperature = getEnhancedTemperatureForLevel(targetLevel);
    
    let prompt;
    
    if (isTitle) {
        prompt = getTitlePromptForLevel(cleanText, targetLevel, language);
    } else {
        prompt = getTextPromptForLevel(cleanText, targetLevel, language);
    }

    try {
        const systemMessage = language === 'ru' ? 
            'Вы эксперт по переписыванию текстов на определенные уровни CEFR русского языка, сохраняя основное значение.' :
            'You are an expert at rewriting text to specific CEFR English levels while preserving original meaning and technical terms.';

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: isTitle ? 
                            (language === 'ru' ? 
                                'Вы эксперт по переписыванию заголовков на определенные уровни CEFR русского языка, сохраняя основное значение.' :
                                'You are an expert at rewriting titles to specific CEFR English levels while preserving core meaning.') :
                            systemMessage
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: Math.min(2000, cleanText.length * 2),
                temperature: temperature,
                top_p: 0.95,
                frequency_penalty: getFrequencyPenaltyForLevel(targetLevel)
            })
        });
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        const data = await response.json();
        let rewrittenText = data.choices[0].message.content.trim();
        
        // Remove quotes if present
        rewrittenText = rewrittenText.replace(/^["']|["']$/g, '');
        
        return rewrittenText || text;
        
    } catch (error) {
        console.error('OpenAI API Error:', error);
        return text;
    }
}

// Enhanced temperature mapping for stronger CEFR level representation
function getEnhancedTemperatureForLevel(targetLevel) {
    const temperatureMap = {
        'A1': 0.2,  // Lower temperature for very predictable, simple output
        'A2': 0.3,  // Slightly higher but still constrained
        'B1': 0.5,  // Balanced creativity
        'B2': 0.7,  // More creative variations
        'C1': 0.85, // High creativity for complex structures
        'C2': 0.95  // Maximum creativity for sophisticated language
    };
    return temperatureMap[targetLevel] || 0.5;
}

// Frequency penalty to control repetition
function getFrequencyPenaltyForLevel(targetLevel) {
    const penaltyMap = {
        'A1': 0.5,  // Allow some repetition for simplicity
        'A2': 0.3,  // Less repetition
        'B1': 0.1,  // Minimal repetition
        'B2': 0.0,  // No penalty
        'C1': -0.1, // Encourage diverse vocabulary
        'C2': -0.2  // Strongly encourage diverse, sophisticated vocabulary
    };
    return penaltyMap[targetLevel] || 0.0;
}

// Level-specific title prompts with bilingual support
function getTitlePromptForLevel(originalText, targetLevel, language) {
    if (language === 'ru') {
        const russianLevelInstructions = {
            'A1': `Перепиши этот заголовок на русский язык уровня A1 по шкале CEFR. Используй только самую базовую лексику (первые 500 слов). Сделай его очень простым и понятным. Используй только настоящее время. Максимум 6-8 слов. Сохрани основное значение.`,
            'A2': `Перепиши этот заголовок на русский язык уровня A2 по шкале CEFR. Используй базовую повседневную лексику. Сохраняй предложения короткими и прямыми. Используй простые грамматические структуры. Максимум 8-10 слов.`,
            'B1': `Перепиши этот заголовок на русский язык уровня B1 по шкале CEFR. Используй ясный, практичный язык. Можно использовать некоторые сложные предложения, но сохраняй их понятными. Максимум 10-12 слов.`,
            'B2': `Перепиши этот заголовок на русский язык уровня B2 по шкале CEFR. Используй более разнообразную лексику и сложные синтаксические конструкции. Покажи хорошее владение грамматикой. Можно использовать некоторую академическую лексику.`,
            'C1': `Перепиши этот заголовок на русский язык уровня C1 по шкале CEFR. Используй сложную лексику и сложные грамматические структуры. Можно использовать идиоматические выражения соответственно. Сделай его лаконичным, но выразительным.`,
            'C2': `Перепиши этот заголовок на русский язык уровня C2 по шкале CEFR. Используй высоко сложную, почти native-уровня лексику. Используй сложные риторические приемы и разнообразные синтаксические структуры. Сделай его выразительным и точным.`
        };
        
        const instruction = russianLevelInstructions[targetLevel] || russianLevelInstructions['B1'];
        
        return `${instruction}

Оригинал: "${originalText}"
Переписанный:`;
    } else {
        const englishLevelInstructions = {
            'A1': `Rewrite this title to CEFR level A1 English. Use only the most basic vocabulary (first 500 words). Make it extremely simple and clear. Use only present tense. Maximum 8 words. Preserve the core meaning.`,
            'A2': `Rewrite this title to CEFR level A2 English. Use basic everyday vocabulary. Keep sentences short and straightforward. Use simple grammar structures. Maximum 10 words.`,
            'B1': `Rewrite this title to CEFR level B1 English. Use clear, practical language. You can use some compound sentences but keep them understandable. Maximum 12 words.`,
            'B2': `Rewrite this title to CEFR level B2 English. Use more varied vocabulary and complex sentence structures. Show good control of grammar. Can use some academic language.`,
            'C1': `Rewrite this title to CEFR level C1 English. Use sophisticated vocabulary and complex grammatical structures. Can use idiomatic expressions appropriately. Make it concise but impactful.`,
            'C2': `Rewrite this title to CEFR level C2 English. Use highly sophisticated, near-native level vocabulary. Employ complex rhetorical devices and varied sentence structures. Make it eloquent and precise.`
        };
        
        const instruction = englishLevelInstructions[targetLevel] || englishLevelInstructions['B1'];
        
        return `${instruction}

Original: "${originalText}"
Rewritten:`;
    }
}

// Level-specific text prompts with bilingual support
function getTextPromptForLevel(originalText, targetLevel, language) {
    if (language === 'ru') {
        const russianLevelInstructions = {
            'A1': `Перепиши этот текст на русский язык уровня A1 по шкале CEFR. Используй ТОЛЬКО самую базовую лексику (первые 500 слов). Используй очень короткие, простые предложения (максимум 6-8 слов каждое). Используй только настоящее время. Избегай любых сложных грамматических конструкций. Сделай его максимально простым, сохраняя основное значение. Сохрани имена, даты, числа точно.`,
            'A2': `Перепиши этот текст на русский язык уровня A2 по шкале CEFR. Используй базовую повседневную лексику. Используй короткие, понятные предложения (максимум 10-12 слов каждое). Используй простые грамматические структуры (настоящее, прошедшее, будущее время). Избегай сложных предложений. Сделай его прямым и легким для понимания.`,
            'B1': `Перепиши этот текст на русский язык уровня B1 по шкале CEFR. Используй ясный, практичный язык. Можно использовать некоторые сложные предложения и базовые соединительные слова. Покажи владение основными грамматическими структурами. Сделай его читаемым, но с некоторым разнообразием.`,
            'B2': `Перепиши этот текст на русский язык уровня B2 по шкале CEFR. Используй более разнообразную лексику и сложные синтаксические конструкции. Покажи хороший диапазон грамматических структур. Можно использовать некоторую академическую и техническую лексику соответственно. Сохраняй ясность, демонстрируя языковую компетенцию.`,
            'C1': `Перепиши этот текст на русский язык уровня C1 по шкале CEFR. Используй сложную лексику и широкий диапазон сложных грамматических структур. Используй идиоматические выражения и стилистические вариации соответственно. Продемонстрируй точность и беглость. Сделай его выразительным и хорошо структурированным.`,
            'C2': `Перепиши этот текст на русский язык уровня C2 по шкале CEFR. Используй высоко сложную, почти native-уровня лексику с точностью. Используй сложные риторические приемы, разнообразные синтаксические структуры и тонкие стилистические выборы. Продемонстрируй мастерское владение русским языком с большой беглостью и естественностью. Сделай его похожим на экспертный уровень академического или литературного письма.`
        };
        
        const instruction = russianLevelInstructions[targetLevel] || russianLevelInstructions['B1'];
        
        return `${instruction}

Текст: "${originalText}"
Переписанный:`;
    } else {
        const englishLevelInstructions = {
            'A1': `Rewrite this text to CEFR level A1 English. Use ONLY the most basic vocabulary (first 500 words). Use extremely short, simple sentences (max 8 words each). Only use present tense. Avoid any complex grammar. Make it as simple as possible while keeping the core meaning. Preserve names, dates, numbers exactly.`,
            'A2': `Rewrite this text to CEFR level A2 English. Use basic everyday vocabulary. Use short, clear sentences (max 12 words each). Use simple grammar structures (present, past, future simple). Avoid complex clauses. Make it straightforward and easy to understand.`,
            'B1': `Rewrite this text to CEFR level B1 English. Use clear, practical language. You can use some compound sentences and basic connecting words. Show control of main grammatical structures. Make it readable but with some variety.`,
            'B2': `Rewrite this text to CEFR level B2 English. Use more varied vocabulary and complex sentence structures. Show good range of grammatical structures. Can use some academic and technical language appropriately. Maintain clarity while demonstrating language competence.`,
            'C1': `Rewrite this text to CEFR level C1 English. Use sophisticated vocabulary and a wide range of complex grammatical structures. Use idiomatic expressions and stylistic variations appropriately. Demonstrate precision and fluency. Make it eloquent and well-structured.`,
            'C2': `Rewrite this text to CEFR level C2 English. Use highly sophisticated, near-native level vocabulary with precision. Employ complex rhetorical devices, varied sentence structures, and subtle stylistic choices. Demonstrate mastery of English with great fluency and naturalness. Make it sound like expert-level academic or literary writing.`
        };
        
        const instruction = englishLevelInstructions[targetLevel] || englishLevelInstructions['B1'];
        
        return `${instruction}

Text: "${originalText}"
Rewritten:`;
    }
}

// ========== SUMMARIZE PAGE FUNCTIONALITY ==========

// Main function to summarize page content
async function summarizePageContent(apiKey, targetLevel, language = 'en') {
    try {
        const mainContent = extractMainContent();
        
        if (!mainContent || mainContent.trim().length < 100) {
            throw new Error('Not enough content found to summarize');
        }
        
        chrome.runtime.sendMessage({ action: 'progressUpdate', progress: 25 });
        
        const summary = await createSummary(mainContent, targetLevel, apiKey, language);
        
        chrome.runtime.sendMessage({ action: 'progressUpdate', progress: 75 });
        
        // Download summary as text file
        downloadSummaryAsText(summary, targetLevel, language);
        
        chrome.runtime.sendMessage({ action: 'progressUpdate', progress: 100 });
        
        return { success: true, summaryLength: summary.length };
        
    } catch (error) {
        console.error('Content summarization error:', error);
        return { success: false, error: error.message };
    }
}

// Create summary using OpenAI with bilingual support
async function createSummary(content, targetLevel, apiKey, language) {
    const cleanContent = cleanTextContent(content).substring(0, 12000);
    
    let prompt;
    
    if (language === 'ru') {
        prompt = `Суммаризируй следующий текст на русский язык уровня ${targetLevel} по шкале CEFR. 
        Сделай суммаризацию комплексной, но лаконичной. Сохрани ключевые факты, имена, даты и важную информацию.
        
        Текст: "${cleanContent}"
        
        Суммаризация:`;
    } else {
        prompt = `Summarize the following text to CEFR level ${targetLevel} English. 
        Make the summary comprehensive but concise. Preserve key facts, names, dates, and important information.
        
        Text: "${cleanContent}"
        
        Summary:`;
    }

    try {
        const systemMessage = language === 'ru' ? 
            'Вы создаете комплексные суммаризации на определенных уровнях CEFR русского языка, сохраняя ключевую информацию.' :
            'You create comprehensive summaries at specific CEFR English levels while preserving key information.';

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: systemMessage
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        const data = await response.json();
        return data.choices[0].message.content.trim();
        
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw new Error('Failed to create summary');
    }
}

// Download summary as text file with language-specific naming
function downloadSummaryAsText(summary, targetLevel, language) {
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const langSuffix = language === 'ru' ? 'RU' : 'EN';
    const filename = `summary-${targetLevel}-${langSuffix}-${timestamp}.txt`;
    
    chrome.runtime.sendMessage({
        action: 'download',
        url: url,
        filename: filename
    });
}

// ========== UTILITY FUNCTIONS ==========

// STRICT element filtering to avoid random blocks
function shouldProcessElementStrict(element) {
    const tagName = element.tagName.toLowerCase();
    const className = element.className.toLowerCase();
    const text = element.textContent.trim();
    
    // Don't process very short texts that might be UI elements
    if (text.length < 30 && !tagName.match(/^h[1-6]$/)) {
        return false;
    }
    
    // Don't process elements with certain classes
    const excludeClasses = ['meta', 'time', 'date', 'author', 'byline', 'caption', 'label'];
    for (const excludeClass of excludeClasses) {
        if (className.includes(excludeClass)) {
            return false;
        }
    }
    
    // Only process headings and paragraphs in main content areas
    if (tagName.match(/^h[1-6]$/) || tagName === 'p') {
        return isInMainContent(element);
    }
    
    return true;
}

// Check if element is in main content area
function isInMainContent(element) {
    const mainContentSelectors = [
        'main', 'article', '[role="main"]', '.content', '.main-content',
        '.post-content', '.article-content', '.story-content', '.entry-content'
    ];
    
    for (const selector of mainContentSelectors) {
        if (element.closest(selector)) {
            return true;
        }
    }
    
    // If no main content container found, check if it's in body directly
    // but not in header, footer, nav, etc.
    const nonContentContainers = ['header', 'footer', 'nav', 'aside', '.header', '.footer', '.nav', '.sidebar'];
    for (const container of nonContentContainers) {
        if (element.closest(container)) {
            return false;
        }
    }
    
    return true;
}

// Detect random text blocks
function isRandomTextBlock(element) {
    const text = element.textContent.trim();
    
    // Skip elements that are too short and not headings
    if (text.length < 40 && !element.tagName.match(/^H[1-6]$/i)) {
        return true;
    }
    
    // Skip elements that look like metadata, dates, author info
    const metaPatterns = [
        /\d{1,2}\/\d{1,2}\/\d{4}/, // dates
        /^(by|posted|published|updated):?/i, // author info
        /^\d+\s*(comments|shares|likes)$/i, // social counts
        /^[A-Z][a-z]+day,\s+[A-Z][a-z]+\s+\d{1,2}/i, // full dates
        /^(автор|опубликовано|обновлено):?/i // Russian author info
    ];
    
    for (const pattern of metaPatterns) {
        if (pattern.test(text)) {
            return true;
        }
    }
    
    return false;
}

// CONSERVATIVE APPROACH: Maximum layout preservation
function replaceElementTextSimple(element, newText) {
    // Get all direct text nodes (not from nested elements)
    const directTextNodes = [];
    for (let i = 0; i < element.childNodes.length; i++) {
        const node = element.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
            directTextNodes.push(node);
        }
    }
    
    if (directTextNodes.length === 0) {
        // No text nodes - create one
        element.prepend(document.createTextNode(newText + ' '));
    } else if (directTextNodes.length === 1) {
        // Single text node - simple replacement
        directTextNodes[0].textContent = newText;
    } else {
        // Multiple text nodes - replace first, remove others
        directTextNodes[0].textContent = newText;
        for (let i = 1; i < directTextNodes.length; i++) {
            directTextNodes[i].textContent = ' ';
        }
    }
    
    // Visual feedback
    element.style.transition = 'opacity 0.2s ease';
    element.style.opacity = '0.9';
    setTimeout(() => {
        element.style.opacity = '1';
    }, 100);
}

// Check if element is visible
function isVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetWidth > 0 &&
           element.offsetHeight > 0;
}

// Check if element is in navigation
function isInNav(element) {
    return element.closest('nav, .nav, .navigation, .menu, header, .header, footer, .footer, aside, .sidebar');
}

// Check if element is interactive
function isInteractive(element) {
    return element.tagName === 'BUTTON' || 
           element.tagName === 'A' ||
           element.getAttribute('role') === 'button' ||
           element.onclick != null;
}

// Get text nodes from an element
function getTextNodes(element) {
    const textNodes = [];
    
    function findTextNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            textNodes.push(node);
        } else {
            node.childNodes.forEach(findTextNodes);
        }
    }
    
    findTextNodes(element);
    return textNodes;
}

// Reset page to original content
function resetPageContent() {
    if (!isRewritten) return;
    
    originalTexts.forEach(item => {
        item.element.innerHTML = item.originalHTML;
    });
    
    isRewritten = false;
}

// Extract main content from the page
function extractMainContent() {
    // Try to find main content containers first
    const contentSelectors = [
        'article',
        'main',
        '[role="main"]',
        '.content',
        '.main-content',
        '.article-content',
        '.post-content',
        '.story-content',
        '.entry-content'
    ];
    
    for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim().length > 200) {
            return element.textContent;
        }
    }
    
    // Fallback: combine all paragraphs and headings
    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
    const content = Array.from(textElements)
        .filter(el => isVisible(el) && !isInNav(el) && el.textContent.trim().length > 50)
        .map(el => el.textContent.trim())
        .join('\n\n');
    
    return content || document.body.textContent;
}

// Clean text content
function cleanTextContent(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .replace(/[^\S\n]+/g, ' ')
        .trim();
}

// Listen for download requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'download') {
        chrome.downloads.download({
            url: request.url,
            filename: request.filename,
            saveAs: false
        });
        sendResponse({ success: true });
    }
});
