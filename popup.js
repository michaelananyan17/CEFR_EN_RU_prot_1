// Language configuration
const LANGUAGE_CONFIG = {
    'en': {
        cefrLevels: {
            'A1': {
                name: 'Beginner',
                description: 'Can understand and use familiar everyday expressions and very basic phrases.'
            },
            'A2': {
                name: 'Elementary', 
                description: 'Can understand sentences and frequently used expressions related to areas of most immediate relevance.'
            },
            'B1': {
                name: 'Intermediate',
                description: 'Can understand the main points of clear standard input on familiar matters regularly encountered in work, school, leisure, etc.'
            },
            'B2': {
                name: 'Upper Intermediate',
                description: 'Can understand the main ideas of complex text on both concrete and abstract topics, including technical discussions.'
            },
            'C1': {
                name: 'Advanced',
                description: 'Can understand a wide range of demanding, longer texts, and recognize implicit meaning.'
            },
            'C2': {
                name: 'Proficiency',
                description: 'Can understand with ease virtually everything heard or read.'
            }
        },
        uiText: {
            apiTitle: '🔑 OpenAI API Setup',
            apiHelpTitle: 'Where to get API key?',
            apiHelpNote: 'Your API key is stored locally and never shared',
            levelToggle: 'CEFR Level Explanation',
            rewrite: 'Rewrite Page',
            summarize: 'Summarize Page',
            reset: 'Reset to Original',
            saveApiKey: 'Save API Key',
            apiStatusDefault: 'Not configured',
            apiStatusValid: '✅ Configured',
            apiStatusInvalid: '⚠️ Invalid',
            processingRewrite: 'Starting rewrite process...',
            processingSummarize: 'Creating summary...',
            processingReset: 'Resetting page...',
            successRewrite: 'Page rewritten successfully!',
            successSummarize: 'Summary created and downloaded!',
            successReset: 'Page reset to original content',
            errorNoApiKey: 'Please enter and save your OpenAI API key first',
            errorApiKeyInvalid: 'Invalid API key format',
            errorApiKeyShort: 'API key seems too short',
            errorValidationFailed: 'API key validation failed. Please check your key.',
            errorRewrite: 'Error during rewriting',
            errorSummarize: 'Error during summarization',
            errorReset: 'Error resetting page'
        }
    },
    'ru': {
        cefrLevels: {
            'A1': {
                name: 'Начальный',
                description: 'Может понимать и использовать знакомые повседневные выражения и очень простые фразы.'
            },
            'A2': {
                name: 'Элементарный',
                description: 'Может понимать предложения и часто используемые выражения, связанные с основными сферами жизни.'
            },
            'B1': {
                name: 'Средний',
                description: 'Может понимать основные идеи четких сообщений на знакомые темы, регулярно встречающиеся в работе, учебе, досуге и т.д.'
            },
            'B2': {
                name: 'Выше среднего', 
                description: 'Может понимать основные идеи сложного текста на конкретные и абстрактные темы, включая технические обсуждения.'
            },
            'C1': {
                name: 'Продвинутый',
                description: 'Может понимать широкий спектр сложных, объемных текстов и распознавать скрытое значение.'
            },
            'C2': {
                name: 'В совершенстве',
                description: 'Может легко понимать практически все, что слышит или читает.'
            }
        },
        uiText: {
            apiTitle: '🔑 Настройка OpenAI API',
            apiHelpTitle: 'Где взять API ключ?',
            apiHelpNote: 'Ваш API ключ хранится локально и никуда не передается',
            levelToggle: 'Объяснение уровней CEFR',
            rewrite: 'Переписать страницу',
            summarize: 'Суммаризировать',
            reset: 'Вернуть оригинал',
            saveApiKey: 'Сохранить API ключ',
            apiStatusDefault: 'Не настроено',
            apiStatusValid: '✅ Настроено',
            apiStatusInvalid: '⚠️ Неверный',
            processingRewrite: 'Начинаем переписывание...',
            processingSummarize: 'Создаем суммаризацию...',
            processingReset: 'Возвращаем оригинальный контент...',
            successRewrite: 'Страница успешно переписана!',
            successSummarize: 'Суммаризация создана и скачана!',
            successReset: 'Оригинальный контент восстановлен',
            errorNoApiKey: 'Пожалуйста, введите и сохраните ваш OpenAI API ключ',
            errorApiKeyInvalid: 'Неверный формат API ключа',
            errorApiKeyShort: 'API ключ слишком короткий',
            errorValidationFailed: 'Проверка API ключа не удалась. Проверьте ваш ключ.',
            errorRewrite: 'Ошибка при переписывании',
            errorSummarize: 'Ошибка при суммаризации',
            errorReset: 'Ошибка при восстановлении страницы'
        }
    }
};

// DOM elements
const cefrSlider = document.getElementById('cefr-slider');
const cefrLevel = document.getElementById('cefr-level');
const levelName = document.getElementById('level-name');
const levelDescription = document.getElementById('level-description');
const levelToggle = document.getElementById('level-toggle');
const toggleIcon = document.getElementById('toggle-icon');
const rewriteBtn = document.getElementById('rewrite-btn');
const summarizeBtn = document.getElementById('summarize-btn');
const resetBtn = document.getElementById('reset-btn');
const apiKeyInput = document.getElementById('api-key');
const saveApiKeyBtn = document.getElementById('save-api-key');
const statusDiv = document.getElementById('status');
const apiStatus = document.getElementById('api-status');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

// Language elements
const langEnBtn = document.getElementById('lang-en');
const langRuBtn = document.getElementById('lang-ru');
const apiTitle = document.getElementById('api-title');
const apiHelpTitle = document.getElementById('api-help-title');
const apiHelpNote = document.getElementById('api-help-note');
const levelToggleText = document.getElementById('level-toggle-text');

let currentLanguage = 'en';

// Initialize the popup
function initPopup() {
    loadSavedSettings();
    setupEventListeners();
    updateLevelDisplay(cefrSlider.value);
    
    // Listen for progress updates from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'progressUpdate') {
            updateProgress(request.progress);
        }
    });
}

// Load saved settings from chrome.storage
function loadSavedSettings() {
    chrome.storage.sync.get(['apiKey', 'cefrLevel', 'language'], (result) => {
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
            updateApiKeyStatus(result.apiKey);
            rewriteBtn.disabled = false;
            summarizeBtn.disabled = false;
        }
        if (result.cefrLevel) {
            cefrSlider.value = result.cefrLevel;
            updateLevelDisplay(result.cefrLevel);
        }
        if (result.language) {
            setLanguage(result.language);
        } else {
            setLanguage('en');
        }
    });
}

// Set application language
function setLanguage(lang) {
    currentLanguage = lang;
    
    // Update active button state
    langEnBtn.classList.toggle('active', lang === 'en');
    langRuBtn.classList.toggle('active', lang === 'ru');
    
    // Update UI texts
    const texts = LANGUAGE_CONFIG[lang].uiText;
    apiTitle.textContent = texts.apiTitle;
    apiHelpTitle.textContent = texts.apiHelpTitle;
    apiHelpNote.textContent = texts.apiHelpNote;
    levelToggleText.textContent = texts.levelToggle;
    rewriteBtn.textContent = texts.rewrite;
    summarizeBtn.textContent = texts.summarize;
    resetBtn.textContent = texts.reset;
    saveApiKeyBtn.textContent = texts.saveApiKey;
    
    // Update API status text if needed
    if (apiStatus.textContent === 'Not configured' || apiStatus.textContent === 'Не настроено') {
        apiStatus.textContent = texts.apiStatusDefault;
    }
    
    // Update level display
    updateLevelDisplay(cefrSlider.value);
    
    // Save language preference
    chrome.storage.sync.set({ language: lang });
}

// Setup event listeners
function setupEventListeners() {
    cefrSlider.addEventListener('input', (e) => {
        updateLevelDisplay(e.target.value);
        saveCefrLevel(e.target.value);
    });
    
    levelToggle.addEventListener('click', toggleLevelDescription);
    
    rewriteBtn.addEventListener('click', rewritePage);
    summarizeBtn.addEventListener('click', summarizePage);
    resetBtn.addEventListener('click', resetPage);
    saveApiKeyBtn.addEventListener('click', saveApiKey);
    apiKeyInput.addEventListener('input', () => {
        updateApiKeyStatus(apiKeyInput.value.trim());
    });
    
    // Language buttons
    langEnBtn.addEventListener('click', () => setLanguage('en'));
    langRuBtn.addEventListener('click', () => setLanguage('ru'));
}

// Toggle level description visibility
function toggleLevelDescription() {
    levelDescription.classList.toggle('show');
    toggleIcon.textContent = levelDescription.classList.contains('show') ? '▲' : '▼';
}

// Update level display based on slider value
function updateLevelDisplay(value) {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const level = levels[value - 1];
    const levelInfo = LANGUAGE_CONFIG[currentLanguage].cefrLevels[level];
    
    cefrLevel.textContent = level;
    levelName.textContent = levelInfo.name;
    levelDescription.textContent = levelInfo.description;
}

// Save CEFR level to storage
function saveCefrLevel(level) {
    chrome.storage.sync.set({ cefrLevel: level });
}

// Validate API key format
function validateApiKey(apiKey) {
    const texts = LANGUAGE_CONFIG[currentLanguage].uiText;
    
    if (!apiKey) return { valid: false, message: texts.errorNoApiKey };
    if (!apiKey.startsWith('sk-')) return { valid: false, message: texts.errorApiKeyInvalid };
    if (apiKey.length < 20) return { valid: false, message: texts.errorApiKeyShort };
    return { valid: true, message: 'API key looks valid' };
}

// Update API key status display
function updateApiKeyStatus(apiKey) {
    const texts = LANGUAGE_CONFIG[currentLanguage].uiText;
    const validation = validateApiKey(apiKey);
    
    if (apiKey) {
        apiStatus.textContent = validation.valid ? texts.apiStatusValid : texts.apiStatusInvalid;
        apiStatus.className = `api-status ${validation.valid ? 'valid' : 'invalid'}`;
    } else {
        apiStatus.textContent = texts.apiStatusDefault;
        apiStatus.className = 'api-status';
    }
}

// Save API key to storage
function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    const texts = LANGUAGE_CONFIG[currentLanguage].uiText;
    const validation = validateApiKey(apiKey);
    
    if (!validation.valid) {
        showStatus(validation.message, 'error');
        return;
    }

    showStatus('<span class="spinner"></span>Validating API key...', 'processing');
    
    // Test the API key with a simple request
    testApiKey(apiKey).then(isValid => {
        if (isValid) {
            chrome.storage.sync.set({ apiKey: apiKey }, () => {
                showStatus('API key saved and verified!', 'success');
                updateApiKeyStatus(apiKey);
                rewriteBtn.disabled = false;
                summarizeBtn.disabled = false;
            });
        } else {
            showStatus(texts.errorValidationFailed, 'error');
            updateApiKeyStatus('');
        }
    }).catch(error => {
        showStatus(`API key test failed: ${error.message}`, 'error');
        updateApiKeyStatus('');
    });
}

// Test API key with a simple request
async function testApiKey(apiKey) {
    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        if (response.status === 401) {
            return false; // Unauthorized - invalid key
        }
        return response.ok;
    } catch (error) {
        console.error('API key test error:', error);
        return false;
    }
}

// Show status message
function showStatus(message, type = 'info') {
    statusDiv.innerHTML = message;
    statusDiv.className = `status ${type}`;
    
    if (type !== 'processing') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 4000);
    }
}

// Update progress display
function updateProgress(progress) {
    progressContainer.classList.add('show');
    progressFill.style.width = `${progress}%`;
    
    const texts = LANGUAGE_CONFIG[currentLanguage].uiText;
    if (currentLanguage === 'ru') {
        progressText.textContent = `Обработка: ${progress}%`;
    } else {
        progressText.textContent = `Processing: ${progress}%`;
    }
    
    if (progress >= 100) {
        setTimeout(() => {
            progressContainer.classList.remove('show');
        }, 2000);
    }
}

// Rewrite page content
async function rewritePage() {
    const apiKey = apiKeyInput.value.trim();
    const texts = LANGUAGE_CONFIG[currentLanguage].uiText;
    
    if (!apiKey) {
        showStatus(texts.errorNoApiKey, 'error');
        return;
    }
    
    const levelValue = cefrSlider.value;
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const targetLevel = levels[levelValue - 1];
    
    // Show progress container
    progressContainer.classList.add('show');
    updateProgress(0);
    
    showStatus(`<span class="spinner"></span>${texts.processingRewrite}`, 'processing');
    
    try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Send message to content script to rewrite the page
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'rewritePage',
            apiKey: apiKey,
            targetLevel: targetLevel,
            language: currentLanguage
        });
        
        if (response.success) {
            showStatus(texts.successRewrite, 'success');
        } else {
            showStatus(`${texts.errorRewrite}: ${response.error}`, 'error');
            progressContainer.classList.remove('show');
        }
    } catch (error) {
        showStatus(`${texts.errorRewrite}: ${error.message}`, 'error');
        progressContainer.classList.remove('show');
        console.error('Rewrite error:', error);
    }
}

// Summarize page content and download as text file
async function summarizePage() {
    const apiKey = apiKeyInput.value.trim();
    const texts = LANGUAGE_CONFIG[currentLanguage].uiText;
    
    if (!apiKey) {
        showStatus(texts.errorNoApiKey, 'error');
        return;
    }
    
    const levelValue = cefrSlider.value;
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const targetLevel = levels[levelValue - 1];
    
    showStatus(`<span class="spinner"></span>${texts.processingSummarize}`, 'processing');
    
    try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Send message to content script to summarize the page
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'summarizePage',
            apiKey: apiKey,
            targetLevel: targetLevel,
            language: currentLanguage
        });
        
        if (response.success) {
            showStatus(texts.successSummarize, 'success');
        } else {
            showStatus(`${texts.errorSummarize}: ${response.error}`, 'error');
        }
    } catch (error) {
        showStatus(`${texts.errorSummarize}: ${error.message}`, 'error');
        console.error('Summarize error:', error);
    }
}

// Reset page to original content
async function resetPage() {
    const texts = LANGUAGE_CONFIG[currentLanguage].uiText;
    showStatus(`<span class="spinner"></span>${texts.processingReset}`, 'processing');
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'resetPage'
        });
        
        if (response.success) {
            showStatus(texts.successReset, 'success');
        }
    } catch (error) {
        showStatus(`${texts.errorReset}: ${error.message}`, 'error');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initPopup);
