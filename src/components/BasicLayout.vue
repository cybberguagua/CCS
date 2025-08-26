<template>
  <a-layout class="full-page-layout">
    <a-layout-header class="header">
      <div class="logo" />
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <a-menu
        v-model:selectedKeys="selectedKeys1"
        theme="dark"
        mode="horizontal"
        :style="{ lineHeight: '64px' }"
      >
        <a-menu-item key="1" style="font-size: 30px;">吉林省生态敏感性监测评价系统</a-menu-item>
      </a-menu>

        <!-- 右侧登录按钮 -->
        <div style="margin-left: auto; padding-right: 5px;">
          <a-button 
            type="primary" 
            shape="round" 
            @click="visible = true"
            class="login-button"
          >
            <template #icon><UserOutlined /></template>
            登录
          </a-button>
        </div>
        </div>
    </a-layout-header>


     <!-- 登录模态框 -->
    <a-modal v-model:open="visible" title="用户登录" @ok="handleLogin">
      <a-form
        :model="loginForm"
        name="basic"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
      >
        <a-form-item
          label="用户名"
          name="username"
          :rules="[{ required: true, message: '请输入用户名!' }]"
        >
          <a-input v-model:value="loginForm.username" />
        </a-form-item>
        <a-form-item
          label="密码"
          name="password"
          :rules="[{ required: true, message: '请输入密码!' }]"
        >
          <a-input-password v-model:value="loginForm.password" />
        </a-form-item>
      </a-form>
    </a-modal>
    

    <a-layout-content style="padding: 0 25px">
      <a-layout style="padding: 24px 0; background: #f5f5f5">
        <a-layout-sider width="180" style="background-color: #fff;">
          <a-menu
            v-model:selectedKeys="selectedKeys2"
            v-model:openKeys="openKeys"
            mode="inline"
            style="height: 100%;"
            @click="handleMenuClick"
            ref="menuElement"
          >
            <a-menu-item key="sub1">
              <template #icon>
                <user-outlined />
              </template>
              用户中心
            </a-menu-item>

            <!--新加入的内容-->
           <a-menu-item  key="sensitivity">
              <template #icon>
                <laptop-outlined />
              </template>
              <span>
                评价与决策
               </span>
            </a-menu-item>

            <a-sub-menu key="sub3">
             <template #title>
                <span>
                  <notification-outlined/>
                  监测与分析
                </span>
              </template>
              <div class="scrollable-menu">
              <a-menu-item key="9">DEM高程分析</a-menu-item>
              <a-menu-item key="10">坡度</a-menu-item>
              <a-menu-item key="11">坡向</a-menu-item>
              <a-menu-item key="12">地形</a-menu-item>
              <a-menu-item key="13">降水量-2017</a-menu-item>
              <a-menu-item key="14">降水量-2020</a-menu-item>
              <a-menu-item key="15">降水量-2023</a-menu-item>
              <a-menu-item key="16">气温-2017</a-menu-item>
              <a-menu-item key="17">气温-2020</a-menu-item>
              <a-menu-item key="18">气温-2023</a-menu-item>
              <a-menu-item key="19">湿度-2017</a-menu-item>
              <a-menu-item key="20">湿度-2020</a-menu-item>
              <a-menu-item key="21">湿度-2023</a-menu-item>
              <a-menu-item key="22">气候敏感性-2017</a-menu-item>
              <a-menu-item key="23">气候敏感性-2020</a-menu-item>
              <a-menu-item key="24">气候敏感性-2023</a-menu-item>
              <a-menu-item key="25">人口-2017</a-menu-item>
              <a-menu-item key="26">人口-2020</a-menu-item>
              <a-menu-item key="27">人口-2023</a-menu-item>
              <a-menu-item key="28">道路-2017</a-menu-item>
              <a-menu-item key="29">道路-2020</a-menu-item>
              <a-menu-item key="30">道路-2023</a-menu-item>
              <a-menu-item key="31">归一化植被指数-2017</a-menu-item>
              <a-menu-item key="32">归一化植被指数-2020</a-menu-item>
              <a-menu-item key="33">归一化植被指数-2023</a-menu-item>
              <a-menu-item key="34">水域</a-menu-item>
              <a-menu-item key="35">土地-2017</a-menu-item>
              <a-menu-item key="36">土地-2020</a-menu-item>
              <a-menu-item key="37">土地-2023</a-menu-item>
              <a-menu-item key="38">综合敏感性-2017</a-menu-item>
              <a-menu-item key="39">综合敏感性-2020</a-menu-item>
              <a-menu-item key="40">综合敏感性-2023</a-menu-item>
              </div>
            </a-sub-menu>
          </a-menu>
        </a-layout-sider>

        <a-layout-content :style="{ zoom: 1.0, padding: '0 20px', minHeight: '280px' }">

         <div v-if="activeTab === 'dashboard'" class="content-area">

          <div v-if="!showSensitivity && !showMap" style="text-align: center; margin-top: 100px;color: dimgray;">
            <h3>请从左侧菜单选择功能</h3>
          </div>

          <div v-if="showSensitivity" class="sensitivity-content">
            <iframe 
              src="/sensitivity-modules/index.html" 
              style="width: 100%; height: 800px; border: none"
            />
          </div>

          <div v-if="showMap" class="map-content">
            <MapViewer 
              ref="mapViewer" 
              :active-layer="activeLayer" 
            />
            
            <!-- 数据面板 -->
            <!-- <div class="data-panel">
              <a-card v-for="(stat, index) in statistics" :key="index" class="data-card">
                <h3>{{ stat.name }}</h3>
                <div class="data-value">{{ stat.value }}</div>
              </a-card>
            </div> -->
          </div>
        </div>
        </a-layout-content>
      </a-layout>
    </a-layout-content>

    <a-layout-content style="padding: 0 50px">
    </a-layout-content>
  </a-layout>
</template>

<script lang="ts" setup>
import { ref,onMounted, nextTick } from 'vue';
import { UserOutlined, LaptopOutlined, NotificationOutlined } from '@ant-design/icons-vue';
import MapViewer from './MapViewer.vue';

// 获取菜单元素的引用
const menuElement = ref<HTMLElement>();

// 更新滚动条
const updateScrollbar = () => {
  nextTick(() => {
    const scrollableMenus = document.querySelectorAll('.scrollable-menu');
    scrollableMenus.forEach(menu => {
      const menuHeight = menu.scrollHeight;
      const containerHeight = menu.clientHeight;
      
      // 如果内容超出容器高度，添加滚动提示
      if (menuHeight > containerHeight) {
        menu.classList.add('has-scroll');
      } else {
        menu.classList.remove('has-scroll');
      }
    });
  });
};

// 初始化
onMounted(() => {
  updateScrollbar();
  // 监听窗口大小变化
  window.addEventListener('resize', updateScrollbar);
});

const selectedKeys1 = ref<string[]>(['2']);
const selectedKeys2 = ref<string[]>(['1']);
const openKeys = ref<string[]>(['sub1']);
const showMap = ref(false);
const showSensitivity = ref(false);
const activeTab = ref('dashboard');
const activeLayer = ref('basemap');
const mapViewer = ref();

const visible = ref(false);
const loginForm = ref({
  username: '',
  password: ''
});

const handleLogin = () => {
  console.log('登录信息:', loginForm.value);
  visible.value = false;
};

//新加入的内容
// const statistics = ref([
//   { name: '高敏感区域面积', value: '1,250 km²' },
//   { name: '中敏感区域面积', value: '3,420 km²' },
//   { name: '低敏感区域面积', value: '5,780 km²' },
//   { name: '总体敏感指数', value: '0.68' }
// ])

const handleMenuClick = (menuInfo: { key: string }) => {
  // 重置所有显示状态
  console.log('菜单点击:', menuInfo.key);
  showSensitivity.value = false;
  showMap.value = false;

  if (menuInfo.key === 'sensitivity') {
    showSensitivity.value = true
    activeTab.value = 'dashboard'
    return;
  }

  // 处理整体可视数据的子菜单点击
  if (['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20','21', '22', '23', '24', '25', '26', '27', '28', '29', '30','31','32', '33', '34', '35', '36', '37', '38', '39', '40' ].includes(menuInfo.key)) {
    showMap.value = true;
    activeTab.value = 'dashboard';

    // 根据菜单项key转换为图层key
    const layerKey = `option${menuInfo.key}`;
    changeLayer(layerKey);
  }
}

// 修改changeLayer方法
const changeLayer = (layerKey: string) => {
  activeLayer.value = layerKey;
  console.log('切换图层:', layerKey);
  
  // 调用MapViewer组件的方法更新图层可见性
  if (mapViewer.value && mapViewer.value.updateLayerVisibility) {
    mapViewer.value.updateLayerVisibility(layerKey);
  }
};

</script>

<style scoped>
.full-page-layout {
  min-height: 100vh; 
  width: 100vw;
  margin: 0;
  padding: 0;
}
:global(html),
:global(body) {
  margin: 0;
  padding: 0;
  height: 100%;
}
:global(#app) {
  height: 100%;
}
.header .ant-menu-horizontal > .ant-menu-item {
  font-size: 100px;
}
#components-layout-demo-top-side .logo {
  float: left;
  width: 120px;
  height: 31px;
  margin: 16px 24px 16px 0;
  background: rgba(179, 177, 177, 0.3);
}

.ant-row-rtl #components-layout-demo-top-side .logo {
  float: right;
  margin: 16px 0 16px 24px;
}

.site-layout-background {
  background: #6a6868;
}

.data-panel {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-top: 20px;
}

.data-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
}

.data-card h3 {
  color: rgba(0, 0, 0, 0.45);
  font-size: 14px;
  margin-bottom: 8px;
}

.data-value {
  font-size: 24px;
  font-weight: 600;
  color: #1890ff;
}

@media (max-width: 1200px) {
  .data-panel {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .data-panel {
    grid-template-columns: 1fr;
  }
}

.menu-container {
  position: relative;
  height: 100%;
  overflow: hidden;
}

/* 滚动容器样式 */
.scrollable-menu {
  max-height: 650px; /* 最大高度 */
  overflow-y: auto; /* 垂直滚动 */
  scrollbar-width: thin; 
}

/* 滚动条样式 */
.scrollable-menu::-webkit-scrollbar {
  width: 6px;
}

.scrollable-menu::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.scrollable-menu::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.scrollable-menu::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 滚动提示 */
.scrollable-menu.has-scroll {
  padding-right: 4px; 
}

/* 确保菜单项不会溢出 */
.ant-menu-item {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

</style>
