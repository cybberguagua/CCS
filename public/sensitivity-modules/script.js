let regions = [];

// 加载行政区数据
async function loadRegionData() {
	try {
		// 加载区域描述数据
		const descResponse = await fetch('region_descriptions.json');
		const descData = await descResponse.json();
		regions = descData.region_descriptions;
		window.regionDescriptions = regions.reduce((acc, region) => {
			acc[region.name] = region;
			return acc;
		}, {});

		// 加载其他数据
		const [gasResponse, natureResponse, humanResponse] = await Promise.all([
			fetch('gas_sensitivity_levels.json'),
			fetch('nature_sensitivity_levels.json'),
			fetch('human_sensitivity_levels.json')
		]);

		window.gasSensitivityData = await gasResponse.json();
		window.natureSensitivityData = await natureResponse.json();
		window.humanSensitivityData = await humanResponse.json();

		// 初始化图表
		initGasChart();
		initNatureChart();
		initHumanChart();
	} catch (error) {
		console.error('加载数据失败:', error);
	}
}

// 更新行政区显示
function updateRegionDisplay(regionName) {
	const regionInfo = window.regionDescriptions[regionName];
	if (!regionInfo) return;

	const regionContent = document.getElementById('region-info');
	const sensitivityLevel = getSensitivityLevel(regionInfo.description);

	regionContent.innerHTML = `
        <div class="region-item">
            <div class="tags">
                <span class="tag region-name">${regionInfo.name}</span>
                <span class="tag sensitivity-level">${sensitivityLevel}</span>
            </div>
            <div class="basic-info">
                <p class="region-description">${regionInfo.description}</p>
            </div>
        </div>
    `;
}

// 从描述中提取敏感性等级
function getSensitivityLevel(description) {
	if (description.includes('极度敏感')) return '极度敏感';
	if (description.includes('高度敏感')) return '高度敏感';
	if (description.includes('中度敏感')) return '中度敏感';
	if (description.includes('轻度敏感')) return '轻度敏感';
	return '不敏感';
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', loadRegionData);

// 初始化所有图表
document.addEventListener('DOMContentLoaded', function() {
	loadSensitivityData();
});

let sensitivityData = null;
let currentRegion = '';

// 加载敏感性数据
async function loadSensitivityData() {
	try {
		// 并行加载所有数据
		const [sensitivityResponse, gasResponse, natureResponse, humanResponse, climateResponse] = await Promise
			.all([
				fetch('sensitivity_levels.json').then(response => response.json()),
				fetch('gas_sensitivity_levels.json').then(response => response.json()),
				fetch('nature_sensitivity_levels.json').then(response => response.json()),
				fetch('human_sensitivity_levels.json').then(response => response.json()),
				fetch('climate_sensitivity_levels.json').then(response => response.json())
			]);

		// 保存数据到全局变量
		window.sensitivityData = sensitivityResponse;
		window.gasSensitivityData = gasResponse;
		window.natureSensitivityData = natureResponse;
		window.humanSensitivityData = humanResponse;
		window.climateSensitivityData = climateResponse;

		// 所有数据加载完成后初始化图表
		initAllCharts();
	} catch (error) {
		console.error('加载敏感性数据失败:', error);
	}
}

// 初始化所有图表
function initAllCharts() {
	initTrendChart();
	initGasChart();
	initNatureChart();
	initHumanChart();
	initPieChart();
	initBarChart();
	initMap();
}

// 更新当前区域
function updateCurrentRegion(regionName) {
	if (!regionName) return;

	currentRegion = regionName;

	// 更新趋势图
	updateTrendChart();

	// 更新其他图表
	updateGasChart(regionName);
	updateNatureChart(regionName);
	updateHumanChart(regionName);

	// 更新地图选中状态
	if (window.mapChart) {
		window.mapChart.dispatchAction({
			type: 'mapSelect',
			name: regionName
		});
	}

	// 更新行政区显示
	if (typeof updateRegionDisplay === 'function') {
		updateRegionDisplay(regionName);
	}
}

// 生态敏感性变化趋势图
function initTrendChart() {
	const chart = echarts.init(document.getElementById('trendChart'));
	window.trendChart = chart;

	const option = {
		grid: {
			top: '15%',
			left: '3%',
			right: '4%',
			bottom: '3%',
			containLabel: true
		},
		xAxis: {
			type: 'category',
			data: ['2017', '2020', '2023'],
			axisLabel: {
				color: '#fff'
			}
		},
		yAxis: {
			type: 'value',
			min: 1,
			max: 5,
			interval: 1,
			axisLabel: {
				color: '#fff',
				formatter: function(value) {
					const levels = {
						1: '不敏感',
						2: '轻度敏感',
						3: '中度敏感',
						4: '高度敏感',
						5: '极度敏感'
					};
					return levels[value];
				}
			}
		},
		tooltip: {
			trigger: 'axis',
			formatter: function(params) {
				const level = params[0].value;
				const year = params[0].axisValue;
				if (!window.sensitivityData) return `${year}年: 暂无数据`;
				const levels = window.sensitivityData.sensitivity_levels[level];
				return `${year}年<br/>${currentRegion || '未选择区域'}: ${levels || '暂无数据'}`;
			}
		},
		series: [{
			name: '敏感性等级',
			type: 'line',
			smooth: true,
			lineStyle: {
				color: '#00ffff',
				width: 3
			},
			itemStyle: {
				color: '#00ffff'
			},
			symbolSize: 8,
			data: [1, 1, 1]
		}]
	};
	chart.setOption(option);
}

// 更新趋势图数据
function updateTrendChart() {
	if (!window.sensitivityData || !currentRegion || !window.trendChart) {
		console.log('更新趋势图失败:', {
			hasSensitivityData: !!window.sensitivityData,
			currentRegion: currentRegion,
			hasTrendChart: !!window.trendChart
		});
		return;
	}

	const regionData = window.sensitivityData.sensitivity_data[currentRegion];
	if (!regionData) {
		console.warn('未找到区域数据:', currentRegion);
		return;
	}

	console.log('更新趋势图数据:', {
		region: currentRegion,
		data: {
			'2017': regionData['2017'],
			'2020': regionData['2020'],
			'2023': regionData['2023']
		}
	});

	const data = [
		regionData['2017'],
		regionData['2020'],
		regionData['2023']
	];

	window.trendChart.setOption({
		series: [{
			data: data
		}],
		tooltip: {
			formatter: function(params) {
				const level = params[0].value;
				const year = params[0].axisValue;
				const levels = window.sensitivityData.sensitivity_levels[level];
				return `${year}年<br/>${currentRegion}: ${levels}`;
			}
		}
	});
}

// 气候敏感性图
function initGasChart() {
	const chart = echarts.init(document.getElementById('gasChart'));
	window.gasChart = chart; // 保存图表实例以便后续更新

	const option = {
		grid: {
			top: '15%',
			left: '3%',
			right: '4%',
			bottom: '3%',
			containLabel: true
		},
		xAxis: {
			type: 'category',
			data: ['2017', '2020', '2023'],
			axisLabel: {
				color: '#fff'
			}
		},
		yAxis: {
			type: 'value',
			min: 1,
			max: 5,
			interval: 1,
			axisLabel: {
				color: '#fff',
				formatter: function(value) {
					const levels = {
						1: '不敏感',
						2: '轻度敏感',
						3: '中度敏感',
						4: '高度敏感',
						5: '极度敏感'
					};
					return levels[value];
				}
			}
		},
		tooltip: {
			trigger: 'axis',
			formatter: function(params) {
				const level = params[0].value;
				const year = params[0].axisValue;
				const levels = window.gasSensitivityData.sensitivity_levels[level];
				return `${year}年<br/>${currentRegion}: ${levels}`;
			}
		},
		series: [{
			name: '气敏等级',
			type: 'line',
			smooth: true,
			lineStyle: {
				color: '#ff7f50',
				width: 3
			},
			itemStyle: {
				color: '#ff7f50'
			},
			symbolSize: 8,
			data: [1, 1, 1] // 默认数据，将在updateGasChart中更新
		}]
	};
	chart.setOption(option);
}

// 更新气敏图表数据
function updateGasChart(regionName) {
	if (!window.gasSensitivityData || !regionName || !window.gasChart) return;

	const regionData = window.gasSensitivityData.gas_sensitivity_data[regionName];
	if (!regionData) return;

	const data = [
		regionData['2017'],
		regionData['2020'],
		regionData['2023']
	];

	window.gasChart.setOption({
		series: [{
			data: data
		}]
	});
}

// 自然敏感性图
function initNatureChart() {
	const chart = echarts.init(document.getElementById('natureChart'));
	window.natureChart = chart; // 保存图表实例以便后续更新

	const option = {
		grid: {
			top: '15%',
			left: '3%',
			right: '4%',
			bottom: '3%',
			containLabel: true
		},
		xAxis: {
			type: 'category',
			data: ['2017', '2020', '2023'],
			axisLabel: {
				color: '#fff'
			}
		},
		yAxis: {
			type: 'value',
			min: 1,
			max: 5,
			interval: 1,
			axisLabel: {
				color: '#fff',
				formatter: function(value) {
					const levels = {
						1: '不敏感',
						2: '轻度敏感',
						3: '中度敏感',
						4: '高度敏感',
						5: '极度敏感'
					};
					return levels[value];
				}
			}
		},
		tooltip: {
			trigger: 'axis',
			formatter: function(params) {
				const level = params[0].value;
				const year = params[0].axisValue;
				const levels = window.natureSensitivityData.sensitivity_levels[level];
				return `${year}年<br/>${currentRegion}: ${levels}`;
			}
		},
		series: [{
			name: '自然敏感等级',
			type: 'line',
			smooth: true,
			lineStyle: {
				color: '#90ee90',
				width: 3
			},
			itemStyle: {
				color: '#90ee90'
			},
			symbolSize: 8,
			data: [1, 1, 1] // 默认数据，将在updateNatureChart中更新
		}]
	};
	chart.setOption(option);
}

// 更新自然敏感性图表数据
function updateNatureChart(regionName) {
	if (!window.natureSensitivityData || !regionName || !window.natureChart) return;

	const regionData = window.natureSensitivityData.nature_sensitivity_data[regionName];
	if (!regionData) return;

	const data = [
		regionData['2017'],
		regionData['2020'],
		regionData['2023']
	];

	window.natureChart.setOption({
		series: [{
			data: data
		}]
	});
}

// 人类干扰敏感性变化图
function initHumanChart() {
	const chart = echarts.init(document.getElementById('humanChart'));
	window.humanChart = chart; // 保存图表实例以便后续更新

	const option = {
		grid: {
			top: '15%',
			left: '3%',
			right: '4%',
			bottom: '3%',
			containLabel: true
		},
		xAxis: {
			type: 'category',
			data: ['2017', '2020', '2023'],
			axisLabel: {
				color: '#fff'
			}
		},
		yAxis: {
			type: 'value',
			min: 1,
			max: 5,
			interval: 1,
			axisLabel: {
				color: '#fff',
				formatter: function(value) {
					const levels = {
						1: '不敏感',
						2: '轻度敏感',
						3: '中度敏感',
						4: '高度敏感',
						5: '极度敏感'
					};
					return levels[value];
				}
			}
		},
		tooltip: {
			trigger: 'axis',
			formatter: function(params) {
				const level = params[0].value;
				const year = params[0].axisValue;
				const levels = window.humanSensitivityData.sensitivity_levels[level];
				return `${year}年<br/>${currentRegion}: ${levels}`;
			}
		},
		series: [{
			name: '人类干扰敏感等级',
			type: 'line',
			smooth: true,
			lineStyle: {
				color: '#73c0de',
				width: 3
			},
			itemStyle: {
				color: '#73c0de'
			},
			symbolSize: 8,
			data: [1, 1, 1] // 默认数据，将在updateHumanChart中更新
		}]
	};
	chart.setOption(option);
}

// 更新人类干扰敏感性图表数据
function updateHumanChart(regionName) {
	if (!window.humanSensitivityData || !window.humanChart) return;

	const regionData = window.humanSensitivityData.human_sensitivity_data[regionName];
	if (!regionData) return;

	const data = [
		regionData['2017'],
		regionData['2020'],
		regionData['2023']
	];

	window.humanChart.setOption({
		series: [{
			data: data
		}]
	});
}

// 指标权重分配饼图
function initPieChart() {

	const container = document.getElementById('pieChart');
	container.style.width = '100%';
	container.style.margin = '0 auto';
	const chart = echarts.init(container);
	// 加载权重数据
	fetch('sensitivity_weights.json')
		.then(response => response.json())
		.then(data => {
			const indicators = data.综合生态敏感性.子指标;

			// 创建内层饼图数据（主要指标）
			const innerPieData = [{
					value: indicators.地质敏感性.权重值,
					name: '地质敏感性',
					itemStyle: {
						color: '#91cc75'
					}
				},
				{
					value: indicators.气候敏感性.权重值,
					name: '气候敏感性',
					itemStyle: {
						color: '#fac858'
					}
				},
				{
					value: indicators.自然敏感性.权重值,
					name: '自然敏感性',
					itemStyle: {
						color: '#ee6666'
					}
				},
				{
					value: indicators.人类干扰敏感性.权重值,
					name: '人类干扰敏感性',
					itemStyle: {
						color: '#73c0de'
					}
				}
			];

			// 创建外层饼图数据（具体指标）
			const outerPieData = [
				// 地质敏感性组
				{
					value: indicators.地质敏感性.权重值 * indicators.地质敏感性.指标层.高程.权重值,
					name: '高程',
					parentName: '地质敏感性',
					itemStyle: {
						color: '#95c794'
					}
				},
				{
					value: indicators.地质敏感性.权重值 * indicators.地质敏感性.指标层.坡度.权重值,
					name: '坡度',
					parentName: '地质敏感性',
					itemStyle: {
						color: '#7fb972'
					}
				},
				{
					value: indicators.地质敏感性.权重值 * indicators.地质敏感性.指标层.坡向.权重值,
					name: '坡向',
					parentName: '地质敏感性',
					itemStyle: {
						color: '#67ab50'
					}
				},

				// 气候敏感性组
				{
					value: indicators.气候敏感性.权重值 * indicators.气候敏感性.指标层.平均气温.权重值,
					name: '平均气温',
					parentName: '气候敏感性',
					itemStyle: {
						color: '#ffd77a'
					}
				},
				{
					value: indicators.气候敏感性.权重值 * indicators.气候敏感性.指标层.年均降水.权重值,
					name: '年均降水',
					parentName: '气候敏感性',
					itemStyle: {
						color: '#ffcb58'
					}
				},
				{
					value: indicators.气候敏感性.权重值 * indicators.气候敏感性.指标层.相对湿度.权重值,
					name: '相对湿度',
					parentName: '气候敏感性',
					itemStyle: {
						color: '#ffbf36'
					}
				},

				// 自然敏感性组
				{
					value: indicators.自然敏感性.权重值 * indicators.自然敏感性.指标层.NDVI.权重值,
					name: 'NDVI',
					parentName: '自然敏感性',
					itemStyle: {
						color: '#ff8585'
					}
				},
				{
					value: indicators.自然敏感性.权重值 * indicators.自然敏感性.指标层.土地利用.权重值,
					name: '土地利用',
					parentName: '自然敏感性',
					itemStyle: {
						color: '#ff6363'
					}
				},
				{
					value: indicators.自然敏感性.权重值 * indicators.自然敏感性.指标层.水域.权重值,
					name: '水域',
					parentName: '自然敏感性',
					itemStyle: {
						color: '#ff4141'
					}
				},

				// 人类干扰敏感性组
				{
					value: indicators.人类干扰敏感性.权重值 * indicators.人类干扰敏感性.指标层.道路.权重值,
					name: '道路',
					parentName: '人类干扰敏感性',
					itemStyle: {
						color: '#8fd1e8'
					}
				},
				{
					value: indicators.人类干扰敏感性.权重值 * indicators.人类干扰敏感性.指标层.人口密度.权重值,
					name: '人口密度',
					parentName: '人类干扰敏感性',
					itemStyle: {
						color: '#73c0de'
					}
				}
			];

			const option = {
				tooltip: {
					trigger: 'item',
					formatter: function(params) {
						if (params.seriesIndex === 0) {
							const indicator = indicators[params.name];
							return `${params.name}<br/>权重值: ${(indicator.权重值 * 100).toFixed(1)}%`;
						} else {
							const parentIndicator = indicators[params.data.parentName];
							const indicator = parentIndicator.指标层[params.name];
							const totalWeight = indicator.权重值 * parentIndicator.权重值;
							return `${params.data.parentName} - ${params.name}<br/>权重值: ${(indicator.权重值 * 100).toFixed(1)}%<br/>综合权重: ${(totalWeight * 100).toFixed(1)}%`;
						}
					}
				},
				legend: {
					type: 'scroll',
					orient: 'vertical',
					right: -20,
					left: 20,
					top: 20,
					bottom: 20,
					textStyle: {
						color: '#fff'
					}
				},
				series: [{
						name: '主要指标',
						type: 'pie',
						radius: ['0%', '40%'],
						itemStyle: {
							borderRadius: 5,
							borderColor: '#fff',
							borderWidth: 2
						},
						label: {
							show: true,
							position: 'inner',
							formatter: params => {
								const indicator = indicators[params.name];
								return `${params.name}\n${(indicator.权重值 * 100).toFixed(0)}%`;
							},
							fontSize: 14,
							color: '#fff'
						},
						emphasis: {
							label: {
								show: true,
								fontSize: 16,
								fontWeight: 'bold'
							},
							itemStyle: {
								shadowBlur: 10,
								shadowOffsetX: 0,
								shadowColor: 'rgba(0, 0, 0, 0.5)'
							}
						},
						data: innerPieData
					},
					{
						name: '具体指标',
						type: 'pie',
						radius: ['45%', '70%'],
						itemStyle: {
							borderRadius: 5,
							borderColor: '#fff',
							borderWidth: 2
						},
						label: {
							show: true,
							position: 'outside',
							formatter: params => {
								const parentIndicator = indicators[params.data.parentName];
								const indicator = parentIndicator.指标层[params.name];
								const totalWeight = indicator.权重值 * parentIndicator.权重值;
								return `${params.name}\n${(totalWeight * 100).toFixed(1)}%`;
							},
							color: '#fff'
						},
						emphasis: {
							label: {
								show: true,
								fontSize: 16,
								fontWeight: 'bold'
							},
							itemStyle: {
								shadowBlur: 10,
								shadowOffsetX: 0,
								shadowColor: 'rgba(0, 0, 0, 0.5)'
							}
						},
						labelLine: {
							length: 15,
							length2: 10,
							smooth: true,
							lineStyle: {
								color: '#fff'
							}
						},
						data: outerPieData
					}
				]
			};
			chart.setOption(option);
		})
		.catch(error => {
			console.error('加载权重数据失败:', error);
		});
}

// 2023敏感性统计柱状图
function initBarChart() {
	const container = document.getElementById('barChart');
	container.style.height = '780px';
	container.style.width = '100%';
	container.style.maxWidth = '1600px';
	container.style.margin = '0 auto';
	container.style.overflow = 'auto';
	container.style.position = 'relative';

	// 美化滚动条样式
	container.style.scrollbarWidth = 'thin'; // Firefox
	container.style.scrollbarColor = '#6e7681 #0d1117'; // Firefox
	// Webkit浏览器的滚动条样式
	const styleSheet = document.createElement('style');
	styleSheet.textContent = `
        #barChart::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        #barChart::-webkit-scrollbar-track {
            background: #0d1117;
            border-radius: 4px;
        }
        #barChart::-webkit-scrollbar-thumb {
            background: #6e7681;
            border-radius: 4px;
        }
        #barChart::-webkit-scrollbar-thumb:hover {
            background: #8b949e;
        }
    `;
	document.head.appendChild(styleSheet);

	// 创建内部容器用于实际图表
	const chartInner = document.createElement('div');
	chartInner.style.height = '1400px'; // 实际图表的高度
	chartInner.style.width = '100%';
	container.appendChild(chartInner);

	// 初始化图表
	const chart = echarts.init(chartInner);
	window.barChart = chart; // 保存图表实例以供后续使用

	function updateChart(type, year) {
		// 获取所有城市名称（从sensitivityData获取）
		const cities = Object.keys(window.sensitivityData.sensitivity_data).sort();

		let data;
		switch (type) {
			case '生态敏感性':
				data = cities.map(city => window.sensitivityData.sensitivity_data[city][year]);
				break;
			case '气候敏感性':
				data = cities.map(city => window.gasSensitivityData.gas_sensitivity_data[city][year]);
				break;
			case '自然敏感性':
				data = cities.map(city => window.natureSensitivityData.nature_sensitivity_data[city][year]);
				break;
			case '人类干扰敏感性':
				data = cities.map(city => window.humanSensitivityData.human_sensitivity_data[city][year]);
				break;
			case '地质敏感性':
				data = cities.map(city => window.climateSensitivityData.climate_sensitivity_data[city][year]);
				break;
		}

		const option = {
			title: {
				text: `${type} - ${year}年`,
				textStyle: {
					color: '#fff',
					fontSize: 16
				},
				left: 'center',
				top: 10
			},
			tooltip: {
				trigger: 'axis',
				axisPointer: {
					type: 'shadow'
				},
				formatter: function(params) {
					const level = params[0].value;
					let levelText;
					if (type === '地质敏感性') {
						levelText = window.climateSensitivityData.sensitivity_levels[level];
					} else {
						levelText = window.sensitivityData.sensitivity_levels[level];
					}
					return `${params[0].name}<br/>敏感度: ${level} (${levelText})`;
				}
			},
			yAxis: {
				type: 'category',
				data: cities,
				axisLabel: {
					color: '#fff',
					fontSize: 11,
					margin: 8
				},
				axisLine: {},
				axisTick: {
					alignWithLabel: true
				}
			},
			xAxis: {
				type: 'value',
				axisLabel: {
					color: '#fff',
					formatter: function(value) {
						return value;
					},
					fontSize: 12
				},
				splitLine: {
					show: true,
					lineStyle: {
						color: 'rgba(255, 255, 255, 0.1)',
						type: 'dashed'
					}
				},
			},
			series: [{
				name: type,
				type: 'bar',
				data: data,
				barWidth: '40%',
				barCategoryGap: '30%',
				itemStyle: {
					color: function(params) {
						const colors = {
							'生态敏感性': '#36D1DC',
							'气候敏感性': '#FF6B6B',
							'自然敏感性': '#4CAF50',
							'人类干扰敏感性': '#FFD93D',
							'地质敏感性': '#884ea0'
						};
						return colors[type];
					},
				},
				label: {
					show: true,
					position: 'right',
					formatter: function(params) {
						return params.value;
					},
					color: '#fff',
				}
			}]
		};
		chart.setOption(option);
	}

	// 初始更新
	updateChart('生态敏感性', '2023');

	// 暴露更新方法供地图筛选使用
	window.updateBarChart = updateChart;

	// 监听窗口大小变化
	window.addEventListener('resize', function() {
		chart.resize();
	});
}

// 初始化地图
function initMap() {
	const chart = echarts.init(document.getElementById('mainMap'));
	window.mapChart = chart;

	// 创建鹰眼图实例（如果不存在）
	if (!window.overviewChart) {
		const overviewContainer = document.createElement('div');
		overviewContainer.id = 'mapOverview';
		overviewContainer.style.cssText = `
            position: absolute;
            right: 20px;
            bottom: 120px;
            width: 150px;
            height: 100px;
            border: 1px solid #1686cc;
            background: rgba(0,0,0,0.2);
            z-index: 100;
            pointer-events: none;
        `;
		document.getElementById('mainMap').appendChild(overviewContainer);
		window.overviewChart = echarts.init(overviewContainer);
	}

	// 当前选择的数据类型和年份
	let currentDataType = '生态敏感性';
	let currentYear = '2023';

	// 创建筛选控件容器
	const filterContainer = document.createElement('div');
	filterContainer.style.position = 'absolute';
	filterContainer.style.top = '10px';
	filterContainer.style.left = '10px';
	filterContainer.style.zIndex = '100';
	filterContainer.style.display = 'flex';
	filterContainer.style.flexDirection = 'column';
	filterContainer.style.gap = '10px';

	// 类型选择容器
	const typeContainer = document.createElement('div');
	typeContainer.style.background = 'rgba(0,0,0,0.6)';
	typeContainer.style.padding = '10px';
	typeContainer.style.borderRadius = '4px';

	// 创建类型选择按钮组
	const typeButtons = ['生态敏感性', '气候敏感性', '自然敏感性', '人类干扰敏感性', '地质敏感性'].map(type => {
		const button = document.createElement('button');
		button.textContent = type;
		button.value = type;
		button.style.padding = '6px 12px';
		button.style.margin = '0 5px';
		button.style.border = 'none';
		button.style.borderRadius = '4px';
		button.style.cursor = 'pointer';
		button.style.backgroundColor = type === '生态敏感性' ? '#1aa1ff' : 'rgba(255,255,255,0.2)';
		button.style.color = type === '生态敏感性' ? '#fff' : '#ddd';
		button.style.transition = 'all 0.3s ease';
		button.style.fontSize = '14px';
		button.style.fontWeight = 'bold';

		button.addEventListener('mouseover', () => {
			if (button.value !== currentDataType) {
				button.style.backgroundColor = 'rgba(255,255,255,0.3)';
			}
		});

		button.addEventListener('mouseout', () => {
			if (button.value !== currentDataType) {
				button.style.backgroundColor = 'rgba(255,255,255,0.2)';
			}
		});

		button.addEventListener('click', () => {
			// 更新所有按钮样式
			typeButtons.forEach(btn => {
				btn.style.backgroundColor = btn.value === button.value ? '#1aa1ff' :
					'rgba(255,255,255,0.2)';
				btn.style.color = btn.value === button.value ? '#fff' : '#ddd';
			});
			currentDataType = button.value;
			updateMapData();
			if (window.updateBarChart) {
				window.updateBarChart(currentDataType, currentYear);
			}
			updateStatisticsTitle(currentDataType, currentYear);
		});

		return button;
	});

	typeButtons.forEach(button => typeContainer.appendChild(button));

	// 创建年份选择器容器
	const yearContainer = document.createElement('div');
	yearContainer.style.position = 'absolute';
	yearContainer.style.bottom = '20px';
	yearContainer.style.left = '50%';
	yearContainer.style.transform = 'translateX(-50%)';
	yearContainer.style.zIndex = '100';
	yearContainer.style.background = 'rgba(0,0,0,0.6)';
	yearContainer.style.padding = '10px 20px';
	yearContainer.style.borderRadius = '20px';
	yearContainer.style.display = 'flex';
	yearContainer.style.alignItems = 'center';
	yearContainer.style.gap = '15px';

	// 年份标签
	const yearLabel = document.createElement('span');
	yearLabel.textContent = '年份：';
	yearLabel.style.color = '#fff';
	yearLabel.style.fontSize = '14px';
	yearContainer.appendChild(yearLabel);

	// 创建年份选择按钮组
	const yearButtons = ['2017', '2020', '2023'].map(year => {
		const button = document.createElement('button');
		button.textContent = year;
		button.value = year;
		button.style.padding = '6px 12px';
		button.style.border = 'none';
		button.style.borderRadius = '15px';
		button.style.cursor = 'pointer';
		button.style.backgroundColor = year === '2023' ? '#1aa1ff' : 'rgba(255,255,255,0.2)';
		button.style.color = year === '2023' ? '#fff' : '#ddd';
		button.style.transition = 'all 0.3s ease';
		button.style.fontSize = '14px';
		button.style.fontWeight = 'bold';
		button.style.minWidth = '60px';

		button.addEventListener('mouseover', () => {
			if (button.value !== currentYear) {
				button.style.backgroundColor = 'rgba(255,255,255,0.3)';
			}
		});

		button.addEventListener('mouseout', () => {
			if (button.value !== currentYear) {
				button.style.backgroundColor = 'rgba(255,255,255,0.2)';
			}
		});

		button.addEventListener('click', () => {
			// 更新所有按钮样式
			yearButtons.forEach(btn => {
				btn.style.backgroundColor = btn.value === button.value ? '#1aa1ff' :
					'rgba(255,255,255,0.2)';
				btn.style.color = btn.value === button.value ? '#fff' : '#ddd';
			});
			currentYear = button.value;
			updateMapData();
			if (window.updateBarChart) {
				window.updateBarChart(currentDataType, currentYear);
			}
			updateStatisticsTitle(currentDataType, currentYear);
		});

		return button;
	});

	yearButtons.forEach(button => yearContainer.appendChild(button));

	// 添加到地图容器
	filterContainer.appendChild(typeContainer);
	document.getElementById('mainMap').appendChild(filterContainer);
	document.getElementById('mainMap').appendChild(yearContainer);

	// 颜色映射函数
	function getColor(value, type) {
		if (!value) return '#eee';

		const colorSchemes = {
			'生态敏感性': [
				'#c6e6ff', // 不敏感 - 浅蓝色
				'#7ec2f3', // 轻度敏感 - 中浅蓝色
				'#3498db', // 中度敏感 - 中蓝色
				'#2166ac', // 高度敏感 - 深蓝色
				'#053061' // 极度敏感 - 深蓝色
			],
			'气候敏感性': [
				'#ffe5e5', // 不敏感 - 浅红色
				'#ffb3b3', // 轻度敏感 - 中浅红色
				'#ff8080', // 中度敏感 - 中红色
				'#ff4d4d', // 高度敏感 - 深红色
				'#cc0000' // 极度敏感 - 深红色
			],
			'自然敏感性': [
				'#e5f5e0', // 不敏感 - 浅绿色
				'#c7e9c0', // 轻度敏感 - 中浅绿色
				'#a1d99b', // 中度敏感 - 中绿色
				'#74c476', // 高度敏感 - 深绿色
				'#238b45' // 极度敏感 - 深绿色
			],
			'人类干扰敏感性': [
				'#fff7bc', // 不敏感 - 浅黄色
				'#fee391', // 轻度敏感 - 中浅黄色
				'#fec44f', // 中度敏感 - 中黄色
				'#fe9929', // 高度敏感 - 深黄色
				'#ec7014' // 极度敏感 - 深橙色
			],
			'地质敏感性': [
				'#f2d7d5', // 不敏感 - 浅紫色
				'#d7bde2', // 轻度敏感 - 中浅紫色
				'#af7ac5', // 中度敏感 - 中紫色
				'#884ea0', // 高度敏感 - 深紫色
				'#6c3483' // 极度敏感 - 深紫色
			]
		};

		const colors = colorSchemes[type] || colorSchemes['生态敏感性'];
		return colors[value - 1] || colors[0];
	}

	// 获取指定类型和年份的数据
	function getDataByTypeAndYear(type, year, regionName) {
		let data;
		switch (type) {
			case '生态敏感性':
				data = window.sensitivityData?.sensitivity_data[regionName]?.[year];
				break;
			case '气候敏感性':
				data = window.gasSensitivityData?.gas_sensitivity_data[regionName]?.[year];
				break;
			case '自然敏感性':
				data = window.natureSensitivityData?.nature_sensitivity_data[regionName]?.[year];
				break;
			case '人类干扰敏感性':
				data = window.humanSensitivityData?.human_sensitivity_data[regionName]?.[year];
				break;
			case '地质敏感性':
				data = window.climateSensitivityData?.climate_sensitivity_data[regionName]?.[year];
				break;
		}
		return data || 0;
	}

	// 获取敏感性级别文本
	function getSensitivityLevelText(value) {
		return window.sensitivityData?.sensitivity_levels[value] || '未知';
	}

	// 更新地图数据
	async function updateMapData() {
		try {
			// 检查必要的数据是否已加载
			if (!window.sensitivityData) {
				console.warn('敏感性数据尚未加载完成，等待数据加载...');
				return;
			}

			const [chinaGeoJson, jilinGeoJson] = await Promise.all([
				fetch('json/china.geojson').then(response => {
					if (!response.ok) {
						throw new Error(`Failed to load china.geojson: ${response.status}`);
					}
					return response.json();
				}),
				fetch('json/jilin_county5.geojson').then(response => {
					if (!response.ok) {
						throw new Error(`Failed to load jilin_county5.geojson: ${response.status}`);
					}
					return response.json();
				})
			]);

			// 验证地图数据
			if (!chinaGeoJson.features || !jilinGeoJson.features) {
				throw new Error('Invalid GeoJSON data structure');
			}

			// 确保地图数据的name属性正确
			jilinGeoJson.features.forEach(feature => {
				if (!feature.properties.name) {
					feature.properties.name = feature.properties.NAME;
				}
			});

			// 合并地图数据
			const mergedFeatures = [
				...chinaGeoJson.features.filter(feature => {
					const name = feature.properties.name;
					// 排除北京朝阳区和吉林省
					return name !== '朝阳区' && name !== '吉林省';
				}),
				...jilinGeoJson.features
			];

			const mergedGeoJson = {
				type: 'FeatureCollection',
				features: mergedFeatures
			};

			// 注册地图前先检查是否已注册
			if (echarts.getMap('merged')) {
				echarts.registerMap('merged', mergedGeoJson, {
					// 可以添加地图的其他配置
				});
			} else {
				echarts.registerMap('merged', mergedGeoJson);
			}

			// 提取所有地区名称并规范化
			const regions = jilinGeoJson.features.map(feature => {
				const name = feature.properties.NAME;
				return {
					name: name,
					fullName: name
				};
			});

			// 创建地区数据映射
			const regionDataMap = {};
			regions.forEach(region => {
				const name = region.name;
				const value = getDataByTypeAndYear(currentDataType, currentYear, name);
				if (value) {
					regionDataMap[name] = {
						name: name,
						value: value,
						fullName: region.fullName
					};
				}
			});

			// 更新地图配置
			const option = {
				backgroundColor: 'transparent',
				animation: false,
				progressive: 500,
				progressiveThreshold: 3000,
				visualMap: {
					show: true,
					type: 'piecewise',
					left: 20,
					top: 100,
					pieces: [{
							value: 1,
							label: '不敏感',
							color: getColor(1, currentDataType)
						},
						{
							value: 2,
							label: '轻度敏感',
							color: getColor(2, currentDataType)
						},
						{
							value: 3,
							label: '中度敏感',
							color: getColor(3, currentDataType)
						},
						{
							value: 4,
							label: '高度敏感',
							color: getColor(4, currentDataType)
						},
						{
							value: 5,
							label: '极度敏感',
							color: getColor(5, currentDataType)
						}
					],
					textStyle: {
						color: '#fff'
					}
				},
				tooltip: {
					show: true,
					trigger: 'item',
					formatter: function(params) {
						if (!params.name) return '';

						// 只显示吉林省区域的提示
						if (window.sensitivityData?.sensitivity_data?.[params.name]) {
							const value = getDataByTypeAndYear(currentDataType, currentYear, params.name);
							const sensitivityLevel = getSensitivityLevelText(value);
							return `
                                <div style="font-size:14px;font-weight:bold;margin-bottom:5px">
                                    ${params.name}
                                </div>
                                <div>
                                    ${currentDataType}：${sensitivityLevel} (${value})
                                </div>
                                <div>
                                    年份：${currentYear}
                                </div>
                            `;
						}
						return '';
					}
				},
				series: [{
					name: '中国地图',
					type: 'map',
					map: 'merged',
					roam: true,
					zoom: 8,
					center: [126.5, 43.8],
					scaleLimit: {
						min: 1,
						max: 50
					},
					selectedMode: 'single',
					label: {
						show: true,
						position: 'inside',
						fontSize: 12,
						color: '#fff',
						fontWeight: 'bold',
						padding: [3, 5],
						textBorderColor: '#000',
						textBorderWidth: 2,
						textShadowBlur: 2,
						textShadowColor: '#000',
						formatter: function(params) {
							// 获取当前地图的缩放级别
							const zoom = chart.getOption().series[0].zoom;
							// 当缩放级别小于4时不显示标签
							if (zoom < 4) {
								return '';
							}
							return params.name;
						}
					},
					itemStyle: {
						areaColor: '#323c48',
						borderColor: 'rgba(22, 134, 204, 0.2)',
						borderWidth: 1,
						shadowColor: 'rgba(0, 0, 0, 0.5)',
						shadowBlur: 10,
						shadowOffsetX: 5,
						shadowOffsetY: 5
					},
					emphasis: {
						label: {
							show: true,
							color: '#fff',
							fontWeight: 'bold',
							textBorderColor: '#000',
							textBorderWidth: 2,
							textShadowBlur: 2,
							textShadowColor: '#000'
						},
						itemStyle: {
							areaColor: '#FFD700',
							opacity: 0.8,
							shadowColor: 'rgba(0, 0, 0, 0.5)',
							shadowBlur: 20,
							shadowOffsetX: 10,
							shadowOffsetY: 10
						}
					},
					select: {
						label: {
							show: true,
							color: '#fff',
							fontWeight: 'bold',
							textBorderColor: '#000',
							textBorderWidth: 2,
							textShadowBlur: 2,
							textShadowColor: '#000'
						},
						itemStyle: {
							areaColor: '#FFD700',
							shadowColor: 'rgba(0, 0, 0, 0.5)',
							shadowBlur: 20,
							shadowOffsetX: 10,
							shadowOffsetY: 10
						}
					},
					data: [
						// 非吉林省区域数据
						...chinaGeoJson.features
						.filter(feature => {
							const name = feature.properties.name;
							// 排除北京朝阳区和吉林省
							return name !== '朝阳区' && name !== '吉林省';
						})
						.map(feature => ({
							name: feature.properties.name,
							itemStyle: {
								areaColor: '#323c48',
								opacity: 0.6
							},
							emphasis: {
								disabled: true
							},
							select: {
								disabled: true
							}
						})),
						// 吉林省区域数据
						...regions.map(region => {
							const regionData = regionDataMap[region.name];
							const value = regionData ? regionData.value : 0;
							return {
								name: region.name,
								value: value,
								height: value * 8,
								itemStyle: {
									areaColor: regionData ? getColor(regionData.value, currentDataType) : '#eee',
									borderWidth: 1.5,
									borderColor: 'rgba(255, 255, 255, 0.7)',
									shadowColor: 'rgba(0, 0, 0, 0.8)',
									shadowBlur: value * 5,
									shadowOffsetX: value * 2,
									shadowOffsetY: value * 2
								},
								emphasis: {
									disabled: false,
									itemStyle: {
										shadowBlur: value * 8,
										shadowOffsetX: value * 3,
										shadowOffsetY: value * 3,
										borderWidth: 2,
										borderColor: '#fff'
									}
								},
								select: {
									disabled: false,
									itemStyle: {
										shadowBlur: value * 10,
										shadowOffsetX: value * 4,
										shadowOffsetY: value * 4,
										borderWidth: 2.5,
										borderColor: '#fff'
									}
								}
							};
						}).filter(item => item && window.sensitivityData?.sensitivity_data?.[item.name])
					]
				}]
			};

			// 更新主地图
			chart.setOption(option);

			// 创建鹰眼图实例（如果不存在）
			if (!window.overviewChart) {
				const overviewContainer = document.createElement('div');
				overviewContainer.id = 'mapOverview';
				overviewContainer.style.cssText = `
                    position: absolute;
                    right: 20px;
                    bottom: 120px;
                    width: 150px;
                    height: 100px;
                    border: 1px solid #1686cc;
                    background: rgba(0,0,0,0.2);
                    z-index: 100;
                    pointer-events: none;
                `;
				document.getElementById('mainMap').appendChild(overviewContainer);
				window.overviewChart = echarts.init(overviewContainer);
			}

			// 更新鹰眼图
			const overviewOption = {
				animation: false,
				visualMap: {
					show: false,
					dimension: 0,
					pieces: option.visualMap.pieces
				},
				series: [{
					name: '鹰眼视图',
					type: 'map',
					map: 'merged',
					roam: false,
					zoom: 1,
					aspectScale: 0.75,
					layoutCenter: ['50%', '50%'],
					layoutSize: '100%',
					selectedMode: false,
					itemStyle: {
						areaColor: '#323c48',
						borderColor: '#1686cc'
					},
					emphasis: {
						disabled: true
					},
					select: {
						disabled: true
					},
					label: {
						show: false
					},
					data: option.series[0].data.map(item => ({
						...item,
						label: {
							show: false
						},
						emphasis: {
							disabled: true
						},
						select: {
							disabled: true
						}
					}))
				}]
			};
			window.overviewChart.setOption(overviewOption, true);

			// 监听主地图视图变化
			chart.off('georoam').on('georoam', function(params) {
				const mainOption = chart.getOption();
				const zoom = mainOption.series[0].zoom;
				const center = mainOption.series[0].center;

				// 根据缩放级别更新标签显示
				chart.setOption({
					series: [{
						label: {
							show: zoom >= 4
						}
					}]
				}, false);

				// 获取主地图的容器尺寸
				const mainWidth = chart.getWidth();
				const mainHeight = chart.getHeight();

				// 获取鹰眼图的容器尺寸
				const overviewWidth = window.overviewChart.getWidth();
				const overviewHeight = window.overviewChart.getHeight();

				// 计算主地图和鹰眼图的宽高比
				const mainRatio = mainWidth / mainHeight;
				const overviewRatio = overviewWidth / overviewHeight;

				// 计算视口尺寸
				const viewWidth = overviewWidth / zoom;
				const viewHeight = overviewHeight / zoom;

				// 计算中心点偏移
				const [centerX, centerY] = center;
				const baseX = 126.5; // 基准经度
				const baseY = 43.8; // 基准纬度

				// 计算经纬度范围
				const lonRange = 10; // 经度范围（根据实际地图调整）
				const latRange = 6; // 纬度范围（根据实际地图调整）

				// 计算偏移量（将经纬度差转换为像素偏移）
				const offsetX = ((centerX - baseX) / lonRange) * overviewWidth;
				const offsetY = ((baseY - centerY) / latRange) * overviewHeight;

				// 计算视口位置（考虑地图比例）
				const x = (overviewWidth / 2) - (viewWidth / 2) + offsetX;
				const y = (overviewHeight / 2) - (viewHeight / 2) + offsetY;

				// 更新鹰眼图上的视口框
				window.overviewChart.setOption({
					graphic: [{
						type: 'rect',
						z: 100,
						shape: {
							x: Math.max(0, Math.min(x, overviewWidth - viewWidth)),
							y: Math.max(0, Math.min(y, overviewHeight - viewHeight)),
							width: Math.min(viewWidth, overviewWidth),
							height: Math.min(viewHeight, overviewHeight)
						},
						style: {
							fill: 'none',
							stroke: '#ff0',
							lineWidth: 2
						}
					}]
				});

				// 更新鹰眼图的缩放级别
				window.overviewChart.setOption({
					series: [{
						zoom: 1,
						center: [126.5, 43.8] // 保持鹰眼图的中心点固定
					}]
				});
			});

			// 确保鹰眼图正确渲染并显示初始视口
			setTimeout(() => {
				window.overviewChart.resize();
				// 触发一次georoam事件以显示初始视口
				chart.dispatchAction({
					type: 'georoam',
					zoom: chart.getOption().series[0].zoom,
					center: chart.getOption().series[0].center
				});
			}, 100);

			// 监听窗口大小变化
			window.addEventListener('resize', () => {
				if (window.overviewChart) {
					window.overviewChart.resize();
				}
			});

		} catch (error) {
			console.error("加载或处理地图数据时出错:", error);
			// 显示错误信息给用户
			const mapContainer = document.getElementById('mainMap');
			if (mapContainer) {
				mapContainer.innerHTML = `
                    <div style="color: #fff; text-align: center; padding: 20px;">
                        地图数据加载失败，请刷新页面重试<br>
                        错误信息: ${error.message}
                    </div>
                `;
			}
		}
	}

	// 初始加载
	updateMapData();

	// 添加重试机制
	let retryCount = 0;
	const maxRetries = 3;

	function retryUpdateMap() {
		if (retryCount < maxRetries) {
			retryCount++;
			console.log(`正在进行第 ${retryCount} 次重试...`);
			setTimeout(updateMapData, 2000 * retryCount); // 递增延迟
		}
	}

	// 监听地图加载错误
	chart.on('renderError', function(params) {
		console.error('地图渲染错误:', params);
		retryUpdateMap();
	});

	// 监听地图点击事件
	chart.on('click', function(params) {
		// 只处理吉林省区域的点击
		if (!params || !params.name || !window.sensitivityData?.sensitivity_data?.[params.name]) {
			return;
		}

		// 更新当前选中的区域
		currentRegion = params.name;

		// 获取当前类型和年份的敏感性值
		const value = getDataByTypeAndYear(currentDataType, currentYear, params.name);
		if (!value) {
			return;
		}

		// 更新行政区显示
		const regionContent = document.getElementById('region-info');
		if (regionContent) {
			const sensitivityLevel = getSensitivityLevelText(value);
			const regionDescription = window.regionDescriptions?.[params.name]?.description || '暂无描述';

			regionContent.innerHTML = `
                <div class="region-item">
                    <div class="tags">
                        <span class="tag region-name">${params.name}</span>
                        <span class="tag sensitivity-level">${sensitivityLevel}</span>
                    </div>
                    <div class="basic-info">
                        <p class="region-description">${regionDescription}</p>
                    </div>
                </div>
            `;
		}

		// 更新所有相关图表
		updateTrendChart();
		updateGasChart(params.name);
		updateNatureChart(params.name);
		updateHumanChart(params.name);

		// 更新地图选中状态
		chart.dispatchAction({
			type: 'select',
			seriesIndex: 1,
			name: params.name
		});

		// 高亮显示选中区域
		chart.dispatchAction({
			type: 'highlight',
			seriesIndex: 1,
			name: params.name
		});
	});

	// 监听鼠标移动事件
	chart.on('mousemove', function(params) {
		// 只允许吉林省区域的鼠标悬停效果
		if (!window.sensitivityData?.sensitivity_data?.[params.name]) {
			chart.dispatchAction({
				type: 'downplay',
				name: params.name
			});
		}
	});

	// 监听地图选中事件，确保只能选中吉林省区域
	chart.on('selectchanged', function(params) {
		if (params.fromAction === 'select' && params.seriesName !== '吉林省区域') {
			// 如果选中的不是吉林省区域，取消选中
			chart.dispatchAction({
				type: 'unselect',
				seriesName: params.seriesName,
				name: params.name
			});
		}
	});

	// 初始化统计图表和标题
	if (window.updateBarChart) {
		window.updateBarChart(currentDataType, currentYear);
	}
	updateStatisticsTitle(currentDataType, currentYear);

	// 确保地图正确渲染
	setTimeout(() => {
		chart.resize();
	}, 100);

	// 监听窗口大小变化
	window.addEventListener('resize', () => {
		chart.resize();
	});
}

// 监听窗口大小变化，调整图表大小
window.addEventListener('resize', function() {
	const charts = document.querySelectorAll('.chart');
	charts.forEach(chart => {
		const instance = echarts.getInstanceByDom(chart);
		if (instance) {
			instance.resize();
		}
	});
});

// 更新统计标题
function updateStatisticsTitle(type, year) {
	const titleElement = document.getElementById('statisticsTitle');
	if (titleElement) {
		titleElement.textContent = `${year}年${type}统计情况`;
	}
}