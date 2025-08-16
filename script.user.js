// ==UserScript==
// @name         强化数据分析
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动收集页面数据并生成排序表格
// @author       XIxixi297
// @match        https://milkonomy.pages.dev/*
// @grant        none
// @run-at       document-end
// @downloadURL https://raw.githubusercontent.com/CYR2077/MWI-milkonomyTool/main/script.user.js
// @updateURL https://raw.githubusercontent.com/CYR2077/MWI-milkonomyTool/main/script.user.js
// ==/UserScript==

(function () {
    'use strict';

    let panel = null;

    // 检查当前URL是否匹配目标页面
    function isTargetPage() {
        return window.location.href === 'https://milkonomy.pages.dev/#/enhancer';
    }

    // 显示或隐藏面板
    function updatePanelVisibility() {
        if (isTargetPage()) {
            if (!panel) createControlPanel();
            if (panel) panel.style.display = 'block';
        } else {
            if (panel) panel.style.display = 'none';
        }
    }

    // 监听URL变化
    function watchUrlChange() {
        let currentUrl = location.href;
        const observer = new MutationObserver(() => {
            if (currentUrl !== location.href) {
                currentUrl = location.href;
                updatePanelVisibility();
            }
        });
        observer.observe(document, { childList: true, subtree: true });
        
        // 监听浏览器前进后退
        window.addEventListener('popstate', updatePanelVisibility);
    }

    const parseNumber = str => {
        const s = str.toString().trim().toUpperCase();
        const map = { 'K': 1e3, 'M': 1e6, 'B': 1e9 };
        const last = s.slice(-1);
        return parseFloat(map[last] ? s.slice(0, -1) : s) * (map[last] || 1);
    };

    function getData() {
        const getValueByColor = (color) => {
            const el = document.querySelector(`.el-table__row[style*="${color}"]`);
            return el ? parseNumber(el.lastElementChild.innerText) : 0;
        };

        const herfElement = document.querySelector('.el-card__body .el-button').parentElement.querySelector('use');
        const herf = herfElement ? herfElement.href.baseVal : '';
        const maxHourlyRate = getValueByColor('rgb(34, 68, 34)');
        const maxUnitProfit = getValueByColor('rgb(34, 51, 85)') || maxHourlyRate;

        return { herf, maxHourlyRate, maxUnitProfit };
    }

    function clickIcon(index) {
        try {
            document.querySelector('.el-card__body .el-button').click();
            const items = document.querySelector('.el-dialog__body').lastElementChild.querySelectorAll('.el-button');
            if (items[index]) items[index].click();
        } catch (error) {
            console.error('点击图标失败:', error);
        }
    }

    async function collectAllData(statusCallback) {
        const allData = [];
        const startButton = document.querySelector('.el-card__body .el-button');

        if (!startButton) throw new Error('未找到起始按钮');

        statusCallback('正在打开界面...', 0);
        startButton.click();
        await new Promise(resolve => setTimeout(resolve, 800));

        const itemsContainer = document.querySelector('.el-dialog__body');
        if (!itemsContainer) throw new Error('未找到项目容器');

        const items = itemsContainer.lastElementChild.querySelectorAll('.el-button');

        for (let i = 0; i < items.length; i++) {
            try {
                const progress = ((i + 1) / items.length) * 100;
                statusCallback(`处理项目 ${i + 1}/${items.length}`, progress);

                items[i].click();
                await new Promise(resolve => setTimeout(resolve, 20));

                const data = getData();
                data.index = i;
                allData.push(data);

            } catch (error) {
                allData.push({
                    index: i,
                    herf: '', maxHourlyRate: 0, maxUnitProfit: 0,
                    error: error.message
                });
            }
        }

        statusCallback(`完成！共处理 ${allData.length} 个项目`, 100);
        return allData;
    }

    function createSortedTable(data, sortBy = 'maxHourlyRate') {
        const sortedData = [...data].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));

        return `
            <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 6px; overflow: hidden;">
                <div style="display: flex; background: #2a2a2a; border-bottom: 1px solid #333; font-size: 12px; color: #ccc;">
                    <div style="flex: 0 0 50px; padding: 8px 12px; border-right: 1px solid #333;">排名</div>
                    <div style="flex: 0 0 50px; padding: 8px 12px; border-right: 1px solid #333;">图标</div>
                    <div style="flex: 1; padding: 8px 12px; border-right: 1px solid #333;">最高工时费</div>
                    <div style="flex: 1; padding: 8px 12px;">单件利润最高时工时费</div>
                </div>
                ${sortedData.map((item, index) => `
                    <div style="display: flex; border-bottom: 1px solid #333; font-size: 12px; color: #fff; ${index % 2 === 0 ? 'background: #1f1f1f;' : ''}">
                        <div style="flex: 0 0 50px; padding: 8px 12px; border-right: 1px solid #333; color: #67c23a;">${index + 1}</div>
                        <div style="flex: 0 0 50px; padding: 8px 12px; border-right: 1px solid #333;">
                            <div onclick="window.clickIconHandler(${item.index})" style="cursor: pointer; width: 20px; height: 20px;">
                                ${item.herf ? `<svg width="20" height="20"><use href="${item.herf}"></use></svg>` : '📊'}
                            </div>
                        </div>
                        <div style="flex: 1; padding: 8px 12px; border-right: 1px solid #333; color: #67c23a; font-weight: 600;">
                            ${formatNumber(item.maxHourlyRate)}
                        </div>
                        <div style="flex: 1; padding: 8px 12px; color: #409eff; font-weight: 600;">
                            ${formatNumber(item.maxUnitProfit)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function formatNumber(num) {
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return num.toFixed(2);
    }

    function displayResults(data) {
        window.clickIconHandler = clickIcon;

        const resultHTML = `
            <div id="result-section">
                <div style="display: flex; margin-bottom: 10px;">
                    <button id="tab-hourly" class="tab-btn" style="flex: 1; padding: 8px; background: #409eff; color: #fff; border: none; border-radius: 4px 0 0 4px; cursor: pointer; font-size: 12px;">按最高工时费排序</button>
                    <button id="tab-profit" class="tab-btn" style="flex: 1; padding: 8px; background: #404040; color: #ccc; border: none; border-radius: 0 4px 4px 0; cursor: pointer; font-size: 12px;">按单件利润最高时工时费排序</button>
                </div>
                <div style="max-height: 400px; overflow-y: auto;">
                    <div id="table-content">${createSortedTable(data, 'maxHourlyRate')}</div>
                </div>
            </div>
        `;

        const existingResult = panel.querySelector('#result-section');
        if (existingResult) existingResult.remove();

        panel.querySelector('#panel-content').insertAdjacentHTML('beforeend', resultHTML);
        panel.style.width = '600px';

        // 标签切换功能
        const tabHourly = panel.querySelector('#tab-hourly');
        const tabProfit = panel.querySelector('#tab-profit');
        const tableContent = panel.querySelector('#table-content');

        tabHourly.addEventListener('click', () => {
            tabHourly.style.background = '#409eff';
            tabHourly.style.color = '#fff';
            tabProfit.style.background = '#404040';
            tabProfit.style.color = '#ccc';
            tableContent.innerHTML = createSortedTable(data, 'maxHourlyRate');
        });

        tabProfit.addEventListener('click', () => {
            tabProfit.style.background = '#409eff';
            tabProfit.style.color = '#fff';
            tabHourly.style.background = '#404040';
            tabHourly.style.color = '#ccc';
            tableContent.innerHTML = createSortedTable(data, 'maxUnitProfit');
        });
    }

    function createControlPanel() {
        panel = document.createElement('div');
        panel.id = 'data-collection-panel';
        panel.style.cssText = `
            position: fixed; top: 20px; right: 20px; width: 280px;
            background: #1a1a1a; border: 1px solid #333; border-radius: 6px;
            z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #fff; font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        let isCollapsed = false, isRunning = false;

        panel.innerHTML = `
            <div id="panel-header" style="padding: 10px 15px; cursor: move; background: #2a2a2a; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600;">强化数据分析</span>
                <button id="collapse-btn" style="background: #404040; border: 1px solid #555; color: #fff; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 11px;">_</button>
            </div>
            <div id="progress-container" style="padding: 0 15px; background: #2a2a2a; border-bottom: 1px solid #333;">
                <div style="height: 3px; background: #404040; border-radius: 2px; margin: 8px 0; overflow: hidden;">
                    <div id="progress-bar" style="height: 100%; background: #67c23a; width: 0%; transition: width 0.3s ease;"></div>
                </div>
            </div>
            <div id="panel-content" style="padding: 15px;">
                <button id="start-btn" style="width: 100%; padding: 8px; background: #409eff; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; margin-bottom: 10px;">开始收集数据</button>
                <div id="status" style="font-size: 12px; color: #909399; min-height: 16px;">准备就绪</div>
            </div>
        `;

        document.body.appendChild(panel);

        // 拖拽功能
        let isDragging = false, currentX = 0, currentY = 0, initialX = 0, initialY = 0;
        const header = panel.querySelector('#panel-header');

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            initialX = e.clientX - currentX;
            initialY = e.clientY - initialY;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                panel.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        });

        document.addEventListener('mouseup', () => isDragging = false);

        // 折叠功能
        panel.querySelector('#collapse-btn').addEventListener('click', () => {
            const content = panel.querySelector('#panel-content');
            if (isCollapsed) {
                content.style.display = 'block';
                panel.querySelector('#collapse-btn').textContent = '_';
            } else {
                content.style.display = 'none';
                panel.querySelector('#collapse-btn').textContent = '□';
            }
            isCollapsed = !isCollapsed;
        });

        // 开始按钮功能
        panel.querySelector('#start-btn').addEventListener('click', async () => {
            if (isRunning) return;

            const startBtn = panel.querySelector('#start-btn');
            const statusDiv = panel.querySelector('#status');
            const progressBar = panel.querySelector('#progress-bar');

            isRunning = true;
            startBtn.disabled = true;
            startBtn.style.opacity = '0.6';
            startBtn.textContent = '运行中...';

            const updateStatus = (message, progress = 0) => {
                statusDiv.textContent = message;
                progressBar.style.width = progress + '%';
            };

            try {
                const data = await collectAllData(updateStatus);
                if (data.length > 0) {
                    displayResults(data);
                    setTimeout(() => updateStatus('完成！点击图标可打开对应项目', 100), 1000);
                } else {
                    updateStatus('未收集到数据', 0);
                }
            } catch (error) {
                updateStatus(`错误: ${error.message}`, 0);
            } finally {
                isRunning = false;
                startBtn.disabled = false;
                startBtn.style.opacity = '1';
                startBtn.textContent = '开始收集数据';
            }
        });
    }

    // 初始化
    function init() {
        watchUrlChange();
        updatePanelVisibility();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('OK！');
})();