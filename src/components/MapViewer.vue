<template>
  <div class="map-container">
    <div ref="mapContainer" class="map-view"></div>

    <!-- 图层控制面板 -->
    <div class="layer-control-panel"
    :style="{ 
        width: panelWidth + 'px', 
        height: panelHeight + 'px',
        top: panelPosition.y + 'px',
        right: panelPosition.x + 'px'
      }" 
     v-if="showLayerControls"
     ref="panel">
     <!-- 面板标题栏 -->
      <div class="panel-header" @mousedown="startDrag">
        <span class="panel-title">图层控制</span>
        <div class="panel-controls">
          <button class="resize-handle" @mousedown.stop="startResize" title="调整大小">↔</button>
          <button class="minimize-btn" @click="togglePanel" title="最小化">−</button>
        </div>
      </div>
      <!-- 面板内容 -->
      <div class="panel-content">
        <div class="layer-list" ref="layerList">
          <div class="layer-item" v-for="layer in operationalLayers" :key="layer.id">
            <div class="layer-info">
              <a-checkbox 
                :checked="layer.visible" 
                @change="(e: Event) => toggleLayerVisibility(layer.id, (e.target as HTMLInputElement).checked)"
                :disabled="layer.status === 'error' || layer.status === 'loading'"
              >
                {{ layer.name }}
              </a-checkbox>
              <span v-if="layer.status === 'loading'" class="layer-status loading">加载中...</span>
              <span v-if="layer.status === 'error'" class="layer-status error">服务不可用</span>
            </div>
            <div class="layer-actions">
              <a-slider 
                v-if="layer.visible && layer.status === 'loaded'"
                v-model:value="layer.opacity" 
                :min="0" 
                :max="1" 
                :step="0.1"
                @change="(value: number) => changeLayerOpacity(layer.id, value)"
                class="layer-slider"
              />
              <button 
                v-if="layer.status === 'error'" 
                @click="retryLoadLayer(layer.id)" 
                class="retry-layer-btn"
              >
                重试
              </button>
            </div>
          </div>
        </div>
        
        <!-- 滚动条 -->
        <div 
          class="scrollbar" 
          v-show="showScrollbar"
          ref="scrollbar"
        >
          <div 
            class="scrollbar-thumb" 
            :style="{ height: thumbHeight + 'px', top: thumbPosition + 'px' }"
            @mousedown="startScroll"
          ></div>
        </div>
      </div>
      <!-- 面板底部信息 -->
      <div class="panel-footer">
        <span>共 {{ Object.keys(operationalLayers).length }} 个图层</span>
        <span>已显示 {{ visibleLayersCount }} 个</span>
      </div>
    </div>

    <!-- 最小化时的面板按钮 -->
    <div 
      class="panel-minimized" 
      v-if="!showLayerControls"
      :style="{ top: panelPosition.y + 'px', left: panelPosition.x + 'px' }"
      @click="togglePanel"
      title="展开图层面板"
    >
      <span>图层控制</span>
    </div>

    <!-- 加载状态提示 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>地图加载中...</p>
    </div>
     <!-- 错误提示 -->
    <div v-if="error" class="error-overlay">
      <p>{{ error }}</p>
      <button @click="initMap" class="retry-btn">重试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef,computed, nextTick } from 'vue'
import Map from '@arcgis/core/Map'
import MapView from '@arcgis/core/views/MapView'
import WebTileLayer from '@arcgis/core/layers/WebTileLayer'
import MapImageLayer from '@arcgis/core/layers/MapImageLayer'
import Polygon from '@arcgis/core/geometry/Polygon'
import SpatialReference from '@arcgis/core/geometry/SpatialReference'
import Point from '@arcgis/core/geometry/Point'

// 定义Props
interface Props {
  activeLayer?: string;
}

const props = withDefaults(defineProps<Props>(), {
  activeLayer: undefined
})

const mapContainer = ref<HTMLDivElement>()
const loading = ref(true)
const error = ref('')
const showLayerControls = ref(true)
//面板
const panelWidth = ref(320)
const panelHeight = ref(500)
const panelPosition = ref({ x: 20, y: 20 })
const isDragging = ref(false)
const isResizing = ref(false)
const dragStart = ref({ x: 0, y: 0 })

//滚动条
const showScrollbar = ref(false)
const thumbHeight = ref(0)
const thumbPosition = ref(0)
const isScrolling = ref(false)
const scrollStartY = ref(0)
const thumbStartTop = ref(0)

// 引用DOM元素
const panel = ref<HTMLElement>()
const layerList = ref<HTMLElement>()
const scrollbar = ref<HTMLElement>()

// 计算可见图层数量
const visibleLayersCount = computed(() => {
  return Object.values(operationalLayers.value).filter(layer => layer.visible).length
})

// 拖动面板
const startDrag = (e: MouseEvent) => {
  isDragging.value = true
  dragStart.value = {
    x: e.clientX - panelPosition.value.x,
    y: e.clientY - panelPosition.value.y
  }
  
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

// 处理拖动
const handleDrag = (e: MouseEvent) => {
  if (!isDragging.value) return
  
  const newX = e.clientX - dragStart.value.x
  const newY = e.clientY - dragStart.value.y
  
  // 限制在可视区域内
  const maxX = window.innerWidth - panelWidth.value
  const maxY = window.innerHeight - panelHeight.value
  
  panelPosition.value.x = Math.max(0, Math.min(maxX, newX))
  panelPosition.value.y = Math.max(0, Math.min(maxY, newY))
}

// 停止拖动
const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}
// 调整大小
const startResize = (e: MouseEvent) => {
  isResizing.value = true
  const startX = e.clientX
  const startY = e.clientY
  const startWidth = panelWidth.value
  const startHeight = panelHeight.value
  
  const handleResize = (e: MouseEvent) => {
    if (!isResizing.value) return
    
    const newWidth = Math.max(250, Math.min(600, startWidth + (e.clientX - startX)))
    const newHeight = Math.max(300, Math.min(700, startHeight + (e.clientY - startY)))
    
    panelWidth.value = newWidth
    panelHeight.value = newHeight
    
    // 更新滚动条
    updateScrollbar()
  }

   const stopResize = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
  }
  
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}
// 切换面板显示状态
const togglePanel = () => {
  showLayerControls.value = !showLayerControls.value
}

const updateScrollbar = () => {
  if (!layerList.value || !scrollbar.value) return
  
  const listHeight = layerList.value.scrollHeight
  const visibleHeight = layerList.value.clientHeight
  
  // 判断是否需要显示滚动条
  showScrollbar.value = listHeight > visibleHeight
  
  if (showScrollbar.value) {
    const trackHeight = scrollbar.value.clientHeight
    thumbHeight.value = Math.max(30, (visibleHeight / listHeight) * trackHeight)
    const maxThumbPosition = trackHeight - thumbHeight.value
    thumbPosition.value = (layerList.value.scrollTop / listHeight) * trackHeight
    thumbPosition.value = Math.min(maxThumbPosition, thumbPosition.value)
  }
}

// 开始滚动
const startScroll = (e: MouseEvent) => {
  isScrolling.value = true
  scrollStartY.value = e.clientY
  thumbStartTop.value = thumbPosition.value
  
  const handleScroll = (e: MouseEvent) => {
    if (!isScrolling.value || !layerList.value) return
    
    const trackHeight = scrollbar.value?.clientHeight || 0
    const deltaY = e.clientY - scrollStartY.value
    const newThumbPosition = Math.max(0, Math.min(trackHeight - thumbHeight.value, thumbStartTop.value + deltaY))
    
    thumbPosition.value = newThumbPosition
    
    // 同步列表滚动
    const listHeight = layerList.value.scrollHeight
    const visibleHeight = layerList.value.clientHeight
    const scrollPercentage = newThumbPosition / (trackHeight - thumbHeight.value)
    layerList.value.scrollTop = scrollPercentage * (listHeight - visibleHeight)
  }

   const stopScroll = () => {
    isScrolling.value = false
    document.removeEventListener('mousemove', handleScroll)
    document.removeEventListener('mouseup', stopScroll)
  }
  
  document.addEventListener('mousemove', handleScroll)
  document.addEventListener('mouseup', stopScroll)
  e.preventDefault()
}

// 监听面板尺寸变化，更新滚动条
watch([panelWidth, panelHeight], () => {
  nextTick(() => {
    updateScrollbar()
  })
})
onMounted(() => {
  updateScrollbar()
  window.addEventListener('resize', updateScrollbar)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScrollbar)
})


const map = shallowRef<Map>()
const view = shallowRef<MapView>()

// 图层管理
interface OperationalLayer {
  id: string;
  name: string;
  url: string;
  visible: boolean;
  opacity: number;
  layer: any;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  retryCount: number;
}

const operationalLayers = shallowRef<Record<string, OperationalLayer>>({
  option9: {
    id: 'option9',
    name: 'DEM高程分析',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/1DEM/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option10: {
    id: 'option10',
    name: '坡度',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/2PODU1/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option11: {
    id: 'option11',
    name: '坡向',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/3POXIANG1/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option12: {
    id: 'option12',
    name: '地形',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/4DIXINGMGX2/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option13: {
    id: 'option13',
    name: '降水量-2017',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/1JIANGSHUI1/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option14: {
    id: 'option14',
    name: '降水量-2020',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/1JIANGSHUI2020/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option15: {
    id: 'option15',
    name: '降水量-2023',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/1JIANGSHUI2023/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option16: {
    id: 'option16',
    name: '气温-2017',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/2QIWEN2017/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option17: {
    id: 'option17',
    name: '气温-2020',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/2QIWEN2020/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option18: {
    id: 'option18',
    name: '气温-2023',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/2QIWEN2023/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option19: {
    id: 'option19',
    name: '湿度-2017',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/3SHIDU2017/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option20: {
    id: 'option20',
    name: '湿度-2020',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/3SHIDU2020/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option21: {
    id: 'option21',
    name: '湿度-2023',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/3SHIDU2023/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option22: {
    id: 'option22',
    name: '气候敏感性-2017',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/4QIHOUMGX2017/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option23: {
    id: 'option23',
    name: '气候敏感性-2020',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/4QIHOUMGX2020/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option24: {
    id: 'option24',
    name: '气候敏感性-2023',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/4QIHOUMGX2023/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option25: {
    id: 'option25',
    name: '人口-2017',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/1RENKOU2017/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option26: {
    id: 'option26',
    name: '人口-2020',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/1RENKOU2020/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option27: {
    id: 'option27',
    name: '人口-2023',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/1RENKOU2023/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option28: {
    id: 'option28',
    name: '道路-2017',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/2DAOLU2017/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option29: {
    id: 'option29',
    name: '道路-2020',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/2DAOLU2020/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option30: {
    id: 'option30',
    name: '道路-2023',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/2DAOLU2023/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option31: {
    id: 'option31',
    name: 'NDVI-2017',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/1NDVI2017/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option32: {
    id: 'option32',
    name: 'NDVI-2020',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/1NDVI2020/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option33: {
    id: 'option33',
    name: 'NDVI-2023',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/1NDVI2023/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option34: {
    id: 'option34',
    name: '水域',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/2SHUIYU/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option35: {
    id: 'option35',
    name: '土地-2017',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/3TUDI2017/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option36: {
    id: 'option36',
    name: '土地-2020',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/3TUDI2020/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option37: {
    id: 'option37',
    name: '土地-2023',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/3TUDI2023/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option38: {
    id: 'option38',
    name: '综合敏感性-2017',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/11ZONGHEMGX/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option39: {
    id: 'option39',
    name: '综合敏感性-2020',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/11ZONGHEMGX2020/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  },
  option40: {
    id: 'option40',
    name: '综合敏感性-2023',
    url: 'https://evazero.geoenterprise.cn/server/rest/services/11ZONGHEMGX2023/MapServer',
    visible: false,
    opacity: 1,
    layer: null,
    status: 'idle',
    retryCount: 0
  }
})

// 天地图配置
const tiandituConfig = {
  tk: '4442a3691392806f05e5f36ff1ec4926',
  subDomains: ['0', '1', '2', '3', '4', '5', '6', '7']
}

// 吉林省边界坐标
const jilinBoundaryCoords = [
  [129.55, 43.85], 
  [131.19, 45.35], 
  [126.15, 46.19], 
  [122.25, 45.65], 
  [121.38, 44.85], 
  [120.85, 43.45], 
  [125.35, 40.50], 
  [128.75, 41.25], 
  [129.55, 43.85]  
]

const jilinPolygon = new Polygon({
  rings: [jilinBoundaryCoords],
  spatialReference: SpatialReference.WGS84
})

// 初始化地图
const initMap = async (): Promise<void> => {
  if (!mapContainer.value) return
  
  try {
    loading.value = true
    error.value = ''
    
    if (view.value) {
      view.value.destroy()
    }

    console.log('开始加载天地图...')

    // 创建天地图图层
    const layer = new WebTileLayer({
      urlTemplate: `https://t{subDomain}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={level}&TILEROW={row}&TILECOL={col}&tk=${tiandituConfig.tk}`,
      subDomains: tiandituConfig.subDomains,
      copyright: '天地图'
    })

    // 创建地图
    map.value = new Map({
      layers: [layer]
    })

    // 创建地图视图
    view.value = new MapView({
      container: mapContainer.value,
      map: map.value,
      center: [126.5, 43.5], 
      zoom: 7,
      constraints: {
        geometry: jilinPolygon,
        minZoom: 6,
        maxZoom: 12,
        rotationEnabled: false
      }
    })
    initOperationalLayers()

    // 监听地图加载事件
    view.value.when(() => {
      console.log('天地图加载成功')
      loading.value = false
      ensureViewWithinJilin()
    }).catch((err: unknown) => {
      console.error('地图加载失败:', err)
      if (err instanceof Error) {
        error.value = `地图加载失败: ${err.message}`
      } else {
        error.value = '地图加载失败: 未知错误'
      }
      loading.value = false
    })

  } catch (err: unknown) {
    console.error('地图初始化异常:', err)
    if (err instanceof Error) {
      error.value = `初始化失败: ${err.message}`
    } else {
      error.value = '初始化失败: 未知错误'
    }
    loading.value = false
  }
}

// 初始化操作图层
const initOperationalLayers = (): void => {
  if (!map.value) return
  const layers: Record<string, OperationalLayer> = {}
  for (const key in operationalLayers.value) {
    const config = operationalLayers.value[key]
    layers[key] = {
      ...config,
      status: 'loading',
      layer: null
    }
    
    loadLayer(key, config.url, config.name)
  }
  
  operationalLayers.value = layers
}

// 加载图层函数
const loadLayer = async (layerId: string, url: string, name: string): Promise<void> => {
  try {
    // 检查服务是否可用
    const isAvailable = await checkServiceAvailability(url)
    if (!isAvailable) {
      throw new Error('服务不可用')
    }
    
    const layer = new MapImageLayer({
      url: url,
      visible: operationalLayers.value[layerId]?.visible || false,
      opacity: operationalLayers.value[layerId]?.opacity || 1,
      title: name,
      // 动态服务优化配置
      refreshInterval: 300, 
      imageFormat: 'png32', 
      // 设置动态图层参数
      imageMaxWidth: 2048,
      imageMaxHeight: 2048
    })
    
    layer.on('layerview-create', () => {
      console.log(`图层 ${name} 加载成功`)
      updateLayerStatus(layerId, 'loaded', layer)
    })
    
    layer.on('layerview-create-error', (event: any) => {
      console.error(`图层 ${name} 加载失败:`, event.error)
      updateLayerStatus(layerId, 'error', null)
      
      // 重试机制
      const currentRetryCount = operationalLayers.value[layerId]?.retryCount || 0
      if (currentRetryCount < 3) {
        setTimeout(() => {
          const layers = { ...operationalLayers.value }
          layers[layerId] = {
            ...layers[layerId],
            retryCount: currentRetryCount + 1
          }
          operationalLayers.value = layers
          
          loadLayer(layerId, url, name)
        }, 2000) 
      }
    })
    
    if (map.value) {
      map.value.add(layer)
    }
    
  } catch (err) {
    console.error(`加载图层 ${name} 失败:`, err)
    updateLayerStatus(layerId, 'error', null)
  }
}

// 检查服务可用性
const checkServiceAvailability = async (url: string): Promise<boolean> => {
  try {
    const testUrl = `${url}?f=json&t=${Date.now()}`
    
    // 设置超时
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(testUrl, {
      method: 'GET',
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      return false
    }
    
    const data = await response.json()
    return !data.error
    
  } catch (err) {
    console.error('服务检查失败:', err)
    return false
  }
}

// 更新图层状态
const updateLayerStatus = (layerId: string, status: 'idle' | 'loading' | 'loaded' | 'error', layer: any): void => {
  const layers = { ...operationalLayers.value }
  if (layers[layerId]) {
    layers[layerId] = {
      ...layers[layerId],
      status,
      layer: layer || layers[layerId].layer
    }
    operationalLayers.value = layers
  }
}

// 切换图层可见性
const toggleLayerVisibility = (layerId: string, visible: boolean): void => {
  const layers = { ...operationalLayers.value }
  if (layers[layerId] && layers[layerId].layer && layers[layerId].status === 'loaded') {
    layers[layerId].layer.visible = visible
    layers[layerId].visible = visible
    operationalLayers.value = layers
  }
}

// 更改图层透明度
const changeLayerOpacity = (layerId: string, opacity: number): void => {
  const layers = { ...operationalLayers.value }
  if (layers[layerId] && layers[layerId].layer && layers[layerId].status === 'loaded') {
    layers[layerId].layer.opacity = opacity
    layers[layerId].opacity = opacity
    operationalLayers.value = layers
  }
}

// 重试加载图层
const retryLoadLayer = (layerId: string): void => {
  const layerConfig = operationalLayers.value[layerId];
  if (layerConfig) {
    const layers = { ...operationalLayers.value };
    layers[layerId] = {
      ...layerConfig,
      retryCount: 0,
      status: 'loading'
    };
    operationalLayers.value = layers;

    // 重新加载图层
    loadLayer(layerId, layerConfig.url, layerConfig.name);
  }
};

// 确保视图在吉林省范围内
const ensureViewWithinJilin = (): void => {
  if (!view.value) return
  
  const currentCenter = view.value.center
  
  // 检查当前中心点是否在吉林省范围内
  if (!jilinPolygon.contains(currentCenter)) {
    view.value.goTo({
      center: new Point({
        x: 126.5,
        y: 43.5,
        spatialReference: SpatialReference.WGS84
      }),
      zoom: view.value.zoom
    }).catch(() => {
      view.value!.center = new Point({
        x: 126.5,
        y: 43.5,
        spatialReference: SpatialReference.WGS84
      })
    })
  }
}

// 监听activeLayer变化
watch(() => props.activeLayer, (newLayer) => {
  if (newLayer && operationalLayers.value[newLayer]) {
    const layers = { ...operationalLayers.value }
    
    // 显示选中的图层，隐藏其他图层
    for (const key in layers) {
      if (key === newLayer && layers[key].status === 'loaded') {
        layers[key].layer.visible = true
        layers[key].visible = true
      } else if (layers[key].status === 'loaded') {
        layers[key].layer.visible = false
        layers[key].visible = false
      }
    }
    
    operationalLayers.value = layers
  }
})

const updateLayerVisibility = (layerKey: string): void => {
  const layers = { ...operationalLayers.value }
  if (layers[layerKey]) {
    for (const key in layers) {
      if (key === layerKey && layers[key].status === 'loaded') {
        layers[key].layer.visible = true
        layers[key].visible = true
      } else if (layers[key].status === 'loaded') {
        layers[key].layer.visible = false
        layers[key].visible = false
      }
    }
    operationalLayers.value = layers
  }
}

// 暴露方法给父组件
defineExpose({
  updateLayerVisibility
})

onMounted(() => {
  initMap()
})

onUnmounted(() => {
  if (view.value) {
    view.value.destroy()
  }
})
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 700px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e8e8e8;
  position: relative;
}

.map-view {
  width: 100%;
  height: 100%;
}

.layer-control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 100;
  width: 280px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 16px;
}

.layer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.layer-item:hover {
  background-color: #f5f5f5;
}

.layer-info {
  display: flex;
  align-items: center;
  flex: 1;
}

.layer-status {
  font-size: 12px;
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 3px;
}

.layer-status.loading {
  color: #1890ff;
  background-color: #e6f7ff;
}

.layer-status.error {
  color: #ff4d4f;
  background-color: #fff2f0;
}

.layer-actions {
  display: flex;
  align-items: center;
}

.layer-slider {
  width: 100px;
  margin-left: 12px;
}

.retry-layer-btn {
  padding: 4px 8px;
  background: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-left: 8px;
}

.retry-layer-btn:hover {
  background: #40a9ff;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  z-index: 100;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #1890ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-overlay {
  background: rgba(255, 235, 235, 0.9);
  color: #d32f2f;
}

.error-overlay p {
  margin-bottom: 16px;
  font-size: 16px;
}

.retry-btn {
  padding: 8px 16px;
  background: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.retry-btn:hover {
  background: #40a9ff;
}

.extent-info {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.8);
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 50;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/*新增样式 */
/* 新增面板样式 */
.layer-control-panel {
  position: absolute;
  z-index: 100;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  resize: both;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f0f5ff;
  border-bottom: 1px solid #d9e7ff;
  cursor: move;
  user-select: none;
}
.panel-title {
  font-weight: 600;
  color: #1f1f1f;
}

.panel-controls {
  display: flex;
  gap: 8px;
}

.panel-controls button {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: #1890ff;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
}
.panel-controls button:hover {
  background: #40a9ff;
}

.panel-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.layer-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
  scrollbar-width: none; /* Firefox */
}

.layer-list::-webkit-scrollbar {
  display: none; /* Chrome, Safari */
}
.scrollbar {
  width: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  margin: 8px 4px 8px 0;
  position: relative;
}

.scrollbar-thumb {
  position: absolute;
  width: 100%;
  background: #c1c1c1;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.scrollbar-thumb:hover {
  background: #a8a8a8;
}
.panel-footer {
  padding: 8px 16px;
  background: #f9f9f9;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #8c8c8c;
}

.panel-minimized {
  position: absolute;
  z-index: 100;
  background: #1890ff;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  user-select: none;
}
.panel-minimized:hover {
  background: #40a9ff;
}

/* 调整原有样式以适应新布局 */
.layer-item {
  display: flex;
  flex-direction: column;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.layer-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.layer-actions {
  padding-left: 24px;
}
.layer-slider {
  min-width: 150px;
}

.layer-status {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
}

.loading {
  background: #e6f7ff;
  color: #1890ff;
}

.error {
  background: #fff2f0;
  color: #ff4d4f;
}
.retry-layer-btn {
  background: #ff4d4f;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.retry-layer-btn:hover {
  background: #ff7875;
}


</style>