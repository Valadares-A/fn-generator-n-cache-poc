// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import './App.css'
import { MailOutlined, AppstoreOutlined, SettingOutlined, BarChartOutlined, MenuOutlined, FieldTimeOutlined, ReconciliationOutlined } from '@ant-design/icons';
import { Button, MenuProps, Space, Tooltip } from 'antd';
import { Breadcrumb, Layout, Menu, theme, message, Select } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl, { GeoJSONSource, LngLatBoundsLike, Map } from 'mapbox-gl'; // eslint-disable-line import/no-webpack-loader-syntax
import axios from 'axios';
import { bbox, center, centroid, point } from 'turf';

mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN';

const items: MenuProps['items'] = [
  {
    label: 'Timeline',
    key: 'timeline',
    icon: <FieldTimeOutlined />,
  },
  {
    label: 'Yield Analysis',
    key: 'yieldAnalysis',
    icon: <ReconciliationOutlined />,
  },
  {
    label: 'Navigation One',
    key: 'mail',
    icon: <MailOutlined />,
  },
  {
    label: 'Navigation Two',
    key: 'app',
    icon: <AppstoreOutlined />,
    disabled: true,
  },
  {
    label: 'Navigation Three - Submenu',
    key: 'SubMenu',
    icon: <SettingOutlined />,
    children: [
      {
        type: 'group',
        label: 'Item 1',
        children: [
          {
            label: 'Option 1',
            key: 'setting:1',
          },
          {
            label: 'Option 2',
            key: 'setting:2',
          },
        ],
      },
      {
        type: 'group',
        label: 'Item 2',
        children: [
          {
            label: 'Option 3',
            key: 'setting:3',
          },
          {
            label: 'Option 4',
            key: 'setting:4',
          },
        ],
      },
    ],
  },
  {
    label: (
      <a href="https://ant.design" target="_blank" rel="noopener noreferrer">
        Navigation Four - Link
      </a>
    ),
    key: 'alipay',
  },
];

const { Header, Content, Sider } = Layout;
const BFF_URL = "http://localhost:3001/bff";
const CACHE_NAME = 'analytics';
let abortController = new AbortController();

async function* processFarmsAndFields(orgId: string, controller: AbortController) {
  try {
    const { data: farmsData } = await axios.get(`${BFF_URL}/farms?orgId=${orgId}`);
    for (const farm of farmsData) {
      // console.log(controller.signal)
      if (controller.signal.aborted) break;
      try {
        const { data } = await axios.get(`${BFF_URL}/fields?farmId=${farm.id}`, {
          signal: controller.signal
        });
        data.forEach((value: any) => {
          value.orgId = orgId;
        })
        yield data;
      } catch (err) {
        yield [];
      }
    }
  } catch (err) {
    yield [];
  }
}


function toggleSidebar(id: string, map: Map) {
  const elem = document.getElementById(id);
  const collapsed = elem?.classList.toggle('collapsed');
  const padding: any = {};
  padding[id] = collapsed ? 0 : 300;
  map.easeTo({
    padding: padding,
    duration: 500
  });
}

function cacheData(url: string, setData: (data: Array<any>) => void) {
  caches.open(CACHE_NAME).then((cacheApi) => {
    cacheApi.match(url).then((appCache) => {
      if (appCache) {
        appCache.json().then((data) => {
          setData(data)
        })
      } else {
        cacheApi.add(url).then(async () => {
          console.log('data cached')
          const res = await cacheApi.match(url);
          const data = await res?.json()
          setData(data);
          //TODO: check if contains data to cache, if not remove the cache key
        });
      }
    })
  });
}


// async function* processOperations(fieldList: Array<any>) {
//   for (const field of fieldList) {
//     const { data } = await axios.get(`${BFF_URL}/operations?orgId=${field.orgId}&fieldId=${field.id}`);
//     yield data;
//   }
// }

function App() {
  //@ts-ignore
  const mapContainer = useRef<any>(null);
  const map = useRef<any>(null);
  const [lng] = useState(-87.623177);
  const [lat] = useState(41.881832);
  const [zoom] = useState(3.8);
  const [orgLoading, setOrgLoading] = useState(false);
  const [farmLoading, setFarmLoading] = useState(false);
  const [cropLoading, setCropLoading] = useState(false);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [orgList, setOrgList] = useState<Array<any>>([]);
  const [farmList, setFarmList] = useState<Array<any>>([]);
  const [fieldList, setfieldList] = useState<Array<any>>([]);
  const [cropList, setCropList] = useState<Array<any>>([]);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [selectedCrop, setSelectedCrop] = useState<any>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const [current, setCurrent] = useState('yieldAnalysis');

  const onClick: MenuProps['onClick'] = (e) => {
    console.log('click ', e);
    setCurrent(e.key);
    toggleSidebar('left', map.current)
  };

  const getOrgs = () => {
    setOrgLoading(true);
    messageApi.destroy();
    messageApi.open({
      key: 'orgs',
      type: 'loading',
      content: 'Loading orgs...',
    });

    function setData(data: Array<any>) {
      setOrgList(data);
      setOrgLoading(false);
      setSelectedOrg(data[0]);
      messageApi.destroy();
      messageApi.open({
        key: 'orgs',
        type: 'success',
        content: 'Orgs Loaded!',
        duration: 1,
      });
      getFarms(data[0].id);
      getCropList(data[0].id);
    }

    const url = `${BFF_URL}/orgs`
    cacheData(url, setData);
  }

  const getFarms = (orgId: string) => {
    setFarmLoading(true);
    function setData(data: Array<any>) {
      setFarmLoading(false);
      setFarmList(data);
    }
    const url = `${BFF_URL}/farms?orgId=${orgId}`;
    cacheData(url, setData);
  }

  const getCropList = (orgId: string) => {
    setCropLoading(true);
    messageApi.destroy();
    messageApi.open({
      key: 'cropList',
      type: 'loading',
      content: 'Loading crop list...',
    });
    function setData(data: Array<any>) {
      setCropLoading(false);
      setCropList(data);
      setSelectedCrop(data[0]);
      messageApi.destroy();
      messageApi.open({
        key: 'cropList',
        type: 'success',
        content: 'Crop list Loaded!',
        duration: 1,
      });
      getFields();
    }
    const url = `${BFF_URL}/${orgId}/crop-list`;
    cacheData(url, setData);
  }

  const getFields = () => {
    setFieldsLoading(true);
    messageApi.destroy();
    messageApi.open({
      key: 'fields',
      type: 'loading',
      content: 'Loading map data...',
    });
    const qtd = Math.floor(Math.random() * 50) + 1;
    axios.get(`${BFF_URL}/engine/fields/${qtd}`).then(({ data }) => {
      setFieldsLoading(false);
      setfieldList(data);
      console.log(data)
      messageApi.destroy();
      messageApi.open({
        key: 'fields',
        type: 'success',
        content: 'Loaded map data!',
        duration: 1,
      });

      const collection = {
        type: 'FeatureCollection' as any,
        features: data.map((field: any) => {
          return {
            type: 'Feature',
            geometry: field.geometry
          }
        }),
      };
      const collectionCluster = {
        type: 'FeatureCollection' as any,
        features: data.map((field: any) => {
          return {
            type: 'Feature',
            geometry: field.centroid ? field.centroid : centroid(field.geometry).geometry
          }
        }),
      };
      setfieldList(data)
      const fieldsSource = map.current.getSource('fields') as GeoJSONSource;
      const clusterSource = map.current.getSource('cluster') as GeoJSONSource;
      fieldsSource?.setData(collection as any);
      clusterSource?.setData(collectionCluster as any);
    });
  }

  useEffect(() => {
    getOrgs();
  }, []);

  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12?optimize=true',
      center: [lng, lat],
      zoom: zoom,
      attributionControl: false,
      maxZoom: 14,
    });
    map.current.once('load', async ({ target: map }: { target: Map }) => {
      map.addSource('fields', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        },
      }).addSource('cluster', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        },
        cluster: true,
        clusterRadius: 20,
      }).addLayer({
        id: 'background',
        type: 'fill',
        source: 'fields',
        paint: {
          'fill-color': '#888888',
          'fill-opacity': 0.4
        },
        minzoom: 10.85
      }).addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'cluster',
        maxzoom: 10.85,
        paint: {
          'circle-color': 'rgba(0,0,0,1)',
          'circle-radius': 20,
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,1)"
        }
      });
      map.on('mouseenter', 'clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('click', 'clusters', (e) => {
        const features: Array<any> = map.queryRenderedFeatures(e.point, {
          layers: ['clusters']
        });
        const clusterId = features[0]?.properties?.cluster_id;
        if (clusterId && clusterId >= 0) {
          //@ts-ignore
          map.getSource('cluster').getClusterExpansionZoom(
            clusterId,
            (err: any, zoom: number) => {
              if (err) return;
              map.easeTo({
                center: features[0].geometry.coordinates,
                zoom: zoom
              });
            }
          );

        }
      });
    })
  }, []);


  return (
    <Layout>
      {contextHolder}
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <div className="demo-logo" />
        <Space wrap>
          <Select
            style={{ width: 300 }}
            placeholder="Select org"
            virtual
            onChange={async (option) => {
              console.log(current)
              switch (current) {
                case 'timeline':
                  if (selectedOrg) {
                    abortController.abort('Changin org');
                    abortController = new AbortController();
                  }
                  setSelectedOrg(option)
                  console.log(option)
                  console.time('run time');
                  messageApi.destroy()
                  messageApi.open({
                    type: 'loading',
                    content: 'Loading map data...',
                    duration: 0,
                  });
                  const fields: Array<any> = [];
                  for await (const data of processFarmsAndFields(option.value, abortController)) {
                    data.forEach((field: any) => {
                      axios.get(`${BFF_URL}/operations?orgId=${field.orgId}&fieldId=${field.id}`).then(({ data }) => {
                        field.operations = data;
                      });
                      field.label = field.name
                      field.value = field.id
                      fields.push(field);
                    })
                    const collection = {
                      type: 'FeatureCollection' as any,
                      features: fields.map((field) => {
                        return {
                          type: 'Feature',
                          geometry: field.geometry
                        }
                      }),
                    };
                    const collectionCluster = {
                      type: 'FeatureCollection' as any,
                      features: fields.map((field) => {
                        return {
                          type: 'Feature',
                          geometry: field.centroid ? field.centroid : centroid(field.geometry).geometry
                        }
                      }),
                    };
                    console.log(fields)
                    setfieldList(fields)
                    const fieldsSource = map.current.getSource('fields') as GeoJSONSource;
                    const clusterSource = map.current.getSource('cluster') as GeoJSONSource;
                    fieldsSource.setData(collection as any);
                    clusterSource.setData(collectionCluster as any);

                    // if (fields.length) {
                    //   map.current.fitBounds(bbox(collection as any) as LngLatBoundsLike, {
                    //     padding: 24,
                    //   });
                    //   // map.flyTo({ center: fields[0].centroid.coordinates, essential: true })
                    // }

                    // for await (const data2 of processOperations(data)) {
                    // console.log('operations: ', data2)
                    // }
                  }
                  messageApi.destroy()
                  messageApi.open({
                    type: 'success',
                    content: 'Map data loaded...',
                    duration: 2,
                  });
                  console.timeEnd('run time');
                  break;
                case 'yieldAnalysis':
                  setSelectedOrg(option)
                  getFarms(option.value);
                  getCropList(option.value);
                  break;

                default:
                  break;
              }
            }}
            // onDropdownVisibleChange={(open) => {
            //   if (open) {
            //     getOrgs();
            //     // openNotification('topRight')
            //   }
            // }}
            value={selectedOrg}
            labelInValue
            loading={orgLoading}
            options={orgList}
          />
          <Select placeholder="Select farm"
            virtual
            onChange={(option) => {
              console.log(option)
            }}
            onDropdownVisibleChange={(open) => {
              if (open) {
                //TODO: get from cache and set on memory when will shows up
                // remove from memory when it closes 
              }
            }}
            labelInValue
            loading={farmLoading}
            options={farmList}
          />
        </Space>
      </Header>
      <Layout>
        <div ref={mapContainer} className="map-container" >
          {current === 'yieldAnalysis' ? (
            <Space wrap style={{
              zIndex: 1,
              position: 'absolute',
              marginTop: '8px',
              marginLeft: '8px',
            }}>
              <Select placeholder="Select Crop Year"
                virtual
                onChange={(option) => {
                  console.log(option)
                  setSelectedCrop(option)
                  getFields();
                }}
                labelInValue
                value={selectedCrop}
                loading={cropLoading}
                options={cropList}
              />
              <Select placeholder="Select field"
                virtual
                onChange={(option) => {
                  const field = fieldList.find((field) => option.value === field.id);
                  if (field) {
                    const cent = centroid(field.geometry).geometry;
                    map.current.easeTo({
                      center: cent.coordinates,
                      zoom: 14
                    });
                  }
                }}
                onDropdownVisibleChange={(open) => {
                  if (open) {
                  }
                }}
                labelInValue
                loading={fieldsLoading}
                options={fieldList}
              />
            </Space>
          ) : null}
          <div id="left" className="sidebar flex-center left collapsed">
            <div className="sidebar-content rounded-rect flex-center">
              <Menu onClick={onClick} selectedKeys={[current]} mode="vertical" items={items} theme='light' />
              <Tooltip title="Menu" placement='right'>
                <div className="sidebar-toggle rounded-rect left" onClick={() => {
                  toggleSidebar('left', map.current)
                }}>
                  {/*&rarr;*/}
                  <MenuOutlined />
                </div>
              </Tooltip>
            </div>
          </div>
          {current === 'yieldAnalysis' ? (<>
            <div id="right" className="sidebar flex-center right collapsed">
              <div className="sidebar-content rounded-rect flex-center">
                Right Sidebar content
                <div className="sidebar-toggle rounded-rect right" onClick={() => {
                  toggleSidebar('right', map.current)
                }}>
                  &larr;
                </div>
              </div>
            </div>
            <div id="bottom" className="sidebarY flex-center bottom collapsed">
              <div className="sidebar-content rounded-rect flex-center">
                <div className='rounded-rect' style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center', width: '100%', height: '100%' }}>
                  <span>Avg. Yield</span>
                  <span>{fieldList.reduce((acc, value) => {
                    return acc + Number(value.by_field.avg_yield);
                  }, 0) / fieldList.length} {' bu/ac'}</span>
                </div>
                <div className='rounded-rect' style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center', width: '100%', height: '100%' }}>
                  <span>Avg. Harvested Area</span>
                  <span>{fieldList.reduce((acc, value) => {
                    return acc + Number(value.by_field.harvested_area);
                  }, 0) / fieldList.length} {' ac'}</span>
                </div>
                <Tooltip title="Yield info">
                  <div className="sidebar-toggle rounded-rect bottom" onClick={() => {
                    toggleSidebar('bottom', map.current)
                  }}>
                    {/*&uarr;*/}
                    <BarChartOutlined />
                  </div>
                </Tooltip>
              </div>
            </div>
          </>) : null}
        </div>
      </Layout>
    </Layout >
  )
}

export default App
