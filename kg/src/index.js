import { historySourceDataX, historySourceDataY } from './history.js';
import { csvDataY } from './y.js';
import { csvDataX } from './x.js';

// echarts 和 ecStat 通过 script 标签全局加载
// CSV 数据通过 webpack 导入（已嵌入）

// Constants
const DAY_IN_MS = 86400000;
const MOVING_AVERAGE_DAYS = 7;
const CHART_START_DATE = '2019-06-01';
const BUTTON_START_YEAR = 2019;
const DEFAULT_BUTTON = '2025-08-19';
const IMPORTANT_DATES = ['2025-02-05', '2025-08-19','2026-02-26'];

// Fill gaps mode: true = fill gaps, false = leave gaps blank
let fillGapsMode = false;
let showDa7 = false;
let showRegression = false;

// Button default states (controls initial 'clicked' class)
const BUTTON_DEFAULTS = {
    fill: fillGapsMode,
    da7: showDa7,
    regression: showRegression
};

const seriesSetting = {
    colorList: ['#d87c7c', '#919e8b'],
    names: ['X', 'Y'],
    selected: {
        'X': true,
        'Y': true,
        'X:da7': showDa7,
        'Y:da7': showDa7,
        'X:regression': showRegression,
        'Y:regression': showRegression
    }
};

function format(date, fmt) {
    const o = {
        'M+': date.getMonth() + 1,
        'd+': date.getDate(),
        'h+': date.getHours(),
        'm+': date.getMinutes(),
        's+': date.getSeconds(),
        'q+': Math.floor((date.getMonth() + 3) / 3),
        'S': date.getMilliseconds()
    };
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
    }
    for (const k in o) {
        if (new RegExp('(' + k + ')').test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
        }
    }
    return fmt;
}

function fill(input) {
    const dataMap = {};

    for (let i = 0; i < input.length; i++) {
        dataMap[input[i][0]] = input[i][1];
    }

    const allDate = [];
    const wait = [];
    const startTime = new Date(input[0][0]).getTime();
    const endTime = new Date().getTime();
    let begin = 0;
    let end = 0;

    for (let i = startTime; i <= endTime; i += DAY_IN_MS) {
        const key = format(new Date(i), 'yyyy-MM-dd');
        const value = dataMap[key];
        if (value === undefined) {
            wait.push(key);
        } else {
            end = value;
            if (wait.length > 0) {
                const delta = (end - begin) / (wait.length + 1);
                for (let j = 0; j < wait.length; j++) {
                    allDate.push([wait[j], parseFloat((begin + delta * (1 + j)).toFixed(2))]);
                }
                wait.length = 0;
            }
            allDate.push([key, parseFloat(value.toFixed(2))]);
            begin = value;
        }
    }
    const lastV = allDate[allDate.length - 1][1];

    for (let j = 0; j < wait.length; j++) {
        allDate.push([wait[j], lastV]);
    }

    return allDate;
}

// No fill: continuous dates, but null for missing data
function noFill(input) {
    const dataMap = {};
    for (let i = 0; i < input.length; i++) {
        dataMap[input[i][0]] = input[i][1];
    }

    const allDate = [];
    const startTime = new Date(input[0][0]).getTime();
    const endTime = new Date().getTime();

    for (let i = startTime; i <= endTime; i += DAY_IN_MS) {
        const key = format(new Date(i), 'yyyy-MM-dd');
        const value = dataMap[key];
        if (value !== undefined) {
            allDate.push([key, parseFloat(value.toFixed(2))]);
        } else {
            allDate.push([key, null]);  // Leave blank for missing data
        }
    }

    return allDate;
}

function getData(search) {
    let filterFunc;
    if (search === 'all') {
        filterFunc = _ => true;
    } else {
        const yearRegex = /(\d{4})(year)/;
        const daysRegex = /(\d+)(days)/;
        const dateRegex = /(\d{4}-\d{2}-\d{2})/;

        if (search.match(yearRegex)) {
            const year = parseInt(search.match(yearRegex)[1]);
            filterFunc = v => new Date(v[0]).getFullYear() >= year;
        } else if (search.match(daysRegex)) {
            const number = parseInt(search.match(daysRegex)[1]);
            filterFunc = v => new Date(v[0]).getTime() >= new Date().getTime() - DAY_IN_MS * number;
        } else if (search.match(dateRegex)) {
            const specifiedDate = new Date(search.match(dateRegex)[1]);
            filterFunc = v => new Date(v[0]).getTime() >= specifiedDate.getTime();
        } else {
            const number = parseInt(search);
            filterFunc = v => new Date(v[0]).getTime() >= new Date().getTime() - DAY_IN_MS * number;
        }
    }

    // Always use filled data for the base (x-axis and calculations)
    // Merge data: csvDataX overrides historySourceDataX for duplicate dates
    const dataMapX = {};
    for (let i = 0; i < historySourceDataX.length; i++) {
        dataMapX[historySourceDataX[i][0]] = historySourceDataX[i][1];
    }
    for (let i = 0; i < csvDataX.length; i++) {
        dataMapX[csvDataX[i][0]] = csvDataX[i][1];
    }
    const rawX = Object.entries(dataMapX).map(([date, value]) => [date, value]).sort((a, b) => new Date(a[0]) - new Date(b[0]));

    const dataMapY = {};
    for (let i = 0; i < historySourceDataY.length; i++) {
        dataMapY[historySourceDataY[i][0]] = historySourceDataY[i][1];
    }
    for (let i = 0; i < csvDataY.length; i++) {
        dataMapY[csvDataY[i][0]] = csvDataY[i][1];
    }
    const rawY = Object.entries(dataMapY).map(([date, value]) => [date, value]).sort((a, b) => new Date(a[0]) - new Date(b[0]));

    const dataX = fill(rawX).filter(filterFunc);
    const dataY = fill(rawY).filter(filterFunc);

    const xAxis = dataX.map(d => d[0]);
    const series = [dataX, dataY].flatMap((subDFilled, index) => {
        // subDFilled: always filled data (for da7 and regression calculation)
        // subD: for display, respects fillGapsMode
        let subD;
        if (fillGapsMode) {
            subD = subDFilled;
        } else {
            // Use the same merged raw data for noFill
            const rawData = (index === 0 ? rawX : rawY);
            // noFill first (to get all dates with gaps), then apply filter
            subD = noFill(rawData).filter(filterFunc);
        }
        // Filter out null values for regression calculation (from filled data)
        const validData = subDFilled.filter(d => d[1] !== null);
        // Use actual time (timestamp) as x-value for regression
        const myRegression = ecStat.regression('linear', validData.map((d) => [new Date(d[0]).getTime(), d[1]]));

        const n = MOVING_AVERAGE_DAYS;
        const subDN = [];
        // Calculate moving average using FILLED data (subDFilled)
        for (let i = 0; i < subDFilled.length; i++) {
            if (subDFilled[i][1] === null) {
                subDN.push(null);
            } else {
                // Look back n days (not n data points)
                const currentDate = new Date(subDFilled[i][0]).getTime();
                let sum = 0;
                let count = 0;
                for (let j = i; j >= 0; j--) {
                    const dateDiff = (currentDate - new Date(subDFilled[j][0]).getTime()) / DAY_IN_MS;
                    if (dateDiff >= n) break;
                    if (subDFilled[j][1] !== null) {
                        sum += subDFilled[j][1];
                        count++;
                    }
                }
                subDN.push(count > 0 ? Math.round(sum / count * 100) / 100 : null);
            }
        }

        const color = seriesSetting.colorList[index];
        const name = seriesSetting.names[index];

        // Build series array - always include main series
        const seriesArray = [
            {
                name: name,
                data: subD.map(d => d[1]),
                type: 'scatter',
                smooth: true,
                color: color,
                connectNulls: false  // Break line at null values
            }
        ];

        // Only add da7 series if button is ON
        if (showDa7) {
            seriesArray.push({
                name: name + ':da7',
                data: subDN,
                type: 'line',
                lineStyle: {
                    type: 'dashed',
                    width: 2
                },
                smooth: true,
                color: color,
                connectNulls: false  // Break line at null values
            });
        }

        // Only add regression series if button is ON
        if (showRegression) {
            seriesArray.push({
                name: name + ':regression',
                type: 'line',
                smooth: true,
                color: color,
                // Map regression points back to array index for display
                data: subDFilled.map((d, i) => {
                    const timestamp = new Date(d[0]).getTime();
                    const y = myRegression.parameter.gradient * timestamp + myRegression.parameter.intercept;
                    return [i, y];
                }),
                markPoint: {
                    itemStyle: {
                        normal: {
                            color: 'transparent'
                        }
                    },
                    label: {
                        normal: {
                            show: true,
                            position: 'left',
                            formatter: myRegression.expression,
                            textStyle: {
                                fontSize: 14,
                                color: color
                            }
                        }
                    },
                    data: [{
                        coord: [subDFilled.length - 1, myRegression.parameter.gradient * new Date(subDFilled[subDFilled.length - 1][0]).getTime() + myRegression.parameter.intercept]
                    }]
                }
            });
        }

        return seriesArray;
    });
    return {xAxis: xAxis, series: series};
}

let myChart = echarts.init(document.getElementById('chart-canvas'));

// Add legend click event to control related series together
myChart.on('legendselectchanged', function (params) {
    const clickedName = params.name;
    const isSelected = params.selected[clickedName];

    // If clicked on X or Y, also toggle their da7 and regression series
    if (clickedName === 'X' || clickedName === 'Y') {
        seriesSetting.selected[clickedName] = isSelected;

        // Only sync da7/regression if their buttons are ON (data exists)
        if (showDa7) {
            seriesSetting.selected[clickedName + ':da7'] = isSelected;
        }
        if (showRegression) {
            seriesSetting.selected[clickedName + ':regression'] = isSelected;
        }

        // Update chart with new selection state
        myChart.setOption({
            legend: {
                selected: seriesSetting.selected
            }
        });
    } else {
        // For da7 and regression series, just update the state
        seriesSetting.selected[clickedName] = isSelected;
    }
});

const currentYear = new Date().getFullYear();
const buttonTexts = [];
for (let year = BUTTON_START_YEAR; year <= currentYear; year++) {
    buttonTexts.push(year + 'year');
}
buttonTexts.push(...['all', '90days', '30days', '14days', '7days']);
buttonTexts.push(...IMPORTANT_DATES);

const buttonsBox = document.getElementById('buttons-box');
buttonTexts.forEach(text => {
    const button = document.createElement('button');
    button.textContent = text;
    if (text === DEFAULT_BUTTON) {
        button.classList.add('clicked');
    } else if (text === 'all') {
        buttonsBox.appendChild(document.createElement('br'));
    }
    button.addEventListener('click', function () {
        refreshButton(this);
    });
    buttonsBox.appendChild(button);
});

const input = document.createElement('input');
input.type = 'number';
input.placeholder = '可输入距离今日的天数';
input.addEventListener('blur', function () {
    refreshButton(this);
});
buttonsBox.appendChild(input);

// Add fill gaps toggle button
const fillToggle = document.createElement('button');
fillToggle.id = 'fill-toggle';
fillToggle.textContent = fillGapsMode ? 'Fill: ON' : 'Fill: OFF';
if (BUTTON_DEFAULTS.fill) {
    fillToggle.classList.add('clicked');
}
fillToggle.addEventListener('click', function () {
    fillGapsMode = !fillGapsMode;
    fillToggle.textContent = fillGapsMode ? 'Fill: ON' : 'Fill: OFF';
    if (fillGapsMode) {
        fillToggle.classList.add('clicked');
    } else {
        fillToggle.classList.remove('clicked');
    }
    // Refresh with current button
    const activeButton = document.querySelector('#buttons-box .clicked:not(#fill-toggle)');
    if (activeButton) {
        refreshButton(activeButton);
    } else {
        refreshButton();
    }
});
buttonsBox.appendChild(fillToggle);

// Add da7 toggle button
const da7Toggle = document.createElement('button');
da7Toggle.id = 'da7-toggle';
da7Toggle.textContent = showDa7 ? 'DA7: ON' : 'DA7: OFF';
if (BUTTON_DEFAULTS.da7) {
    da7Toggle.classList.add('clicked');
}
da7Toggle.addEventListener('click', function () {
    showDa7 = !showDa7;
    da7Toggle.textContent = showDa7 ? 'DA7: ON' : 'DA7: OFF';
    if (showDa7) {
        da7Toggle.classList.add('clicked');
    } else {
        da7Toggle.classList.remove('clicked');
    }
    seriesSetting.selected['X:da7'] = showDa7;
    seriesSetting.selected['Y:da7'] = showDa7;
    // Refresh chart to regenerate data
    const activeButton = document.querySelector('#buttons-box .clicked:not(#fill-toggle):not(#da7-toggle):not(#regression-toggle)');
    if (activeButton) {
        refreshButton(activeButton);
    } else {
        refreshButton();
    }
});
buttonsBox.appendChild(da7Toggle);

// Add regression toggle button
const regressionToggle = document.createElement('button');
regressionToggle.id = 'regression-toggle';
regressionToggle.textContent = showRegression ? 'Regression: ON' : 'Regression: OFF';
if (BUTTON_DEFAULTS.regression) {
    regressionToggle.classList.add('clicked');
}
regressionToggle.addEventListener('click', function () {
    showRegression = !showRegression;
    regressionToggle.textContent = showRegression ? 'Regression: ON' : 'Regression: OFF';
    if (showRegression) {
        regressionToggle.classList.add('clicked');
    } else {
        regressionToggle.classList.remove('clicked');
    }
    seriesSetting.selected['X:regression'] = showRegression;
    seriesSetting.selected['Y:regression'] = showRegression;
    // Refresh chart to regenerate data
    const activeButton = document.querySelector('#buttons-box .clicked:not(#fill-toggle):not(#da7-toggle):not(#regression-toggle)');
    if (activeButton) {
        refreshButton(activeButton);
    } else {
        refreshButton();
    }
});
buttonsBox.appendChild(regressionToggle);

refreshButton();

function refreshButton(button) {
    const search = button && (button.textContent || button.innerText || button.value) || DEFAULT_BUTTON;
    const data = getData(search);
    myChart.setOption({
        tooltip: {
            trigger: 'axis'
        },
        yAxis: {
            scale: true,
            interval: 1,
            splitLine: {
                lineStyle: {
                    type: 'dashed',
                    opacity: 0.7
                }
            }
        },
        legend: {data: seriesSetting.names, selected: seriesSetting.selected},
        dataZoom: [
            {
                startValue: CHART_START_DATE
            },
            {
                type: 'inside'
            }
        ],
        series: data.series,
        xAxis: {
            data: data.xAxis,
        },
    });
    if (button) {
        const activeButton = document.querySelector('.clicked:not(#fill-toggle):not(#da7-toggle):not(#regression-toggle)');
        if (activeButton) {
            activeButton.classList.remove('clicked');
        }
        button.classList.add('clicked');
    }
}