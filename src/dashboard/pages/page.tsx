import React, { type FC, useState, useEffect } from 'react';
import { dashboard } from '@wix/dashboard';
import {
  Button,
  Page,
  WixDesignSystemProvider,
  Card,
  Box,
  FormField,
  Dropdown,
  Accordion,
  Checkbox,
  NumberInput,
  Layout,
  Cell,
  Text,
  Loader,
  Tabs,
  SectionHelper,
  Table,
  Badge,
  IconButton,
  Input
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import * as Icons from '@wix/wix-ui-icons-common';
import { FEE_CATEGORIES, FeeConfig } from '../fees-data';
import { getAllProducts, getAllStoreCategories, saveFeesConfig, getFeesConfig, deleteFeesConfig } from '../../backend/my-web-method.web';

const Index: FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'PRODUCT' | 'CATEGORY' | 'GLOBAL' | 'OVERVIEW'>('GLOBAL');
  const [selectedId, setSelectedId] = useState<string>('');
  const [feesConfig, setFeesConfig] = useState<FeeConfig[]>([]);
  const [allConfigs, setAllConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentConfigId, setCurrentConfigId] = useState<string | null>(null);
  const [hasGlobalConfig, setHasGlobalConfig] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        getAllProducts(),
        getAllStoreCategories()
      ]);
      setProducts(productsRes.items || []);
      setCategories(categoriesRes || []);

      // Load Global by default to check status
      const configs = await getFeesConfig('GLOBAL');
      setHasGlobalConfig(configs && configs.length > 0);

      if (configs && configs.length > 0) {
        setFeesConfig(configs[0].fees);
        setCurrentConfigId(configs[0]._id);
      }
    } catch (error) {
      console.error('Failed to load initial data', error);
      dashboard.showToast({ message: 'Failed to load initial data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadFees = async (type: 'PRODUCT' | 'CATEGORY' | 'GLOBAL', id?: string) => {
    try {
      const configs = await getFeesConfig(type, id);
      if (configs && configs.length > 0) {
        setFeesConfig(configs[0].fees);
        setCurrentConfigId(configs[0]._id);
      } else {
        setFeesConfig([]);
        setCurrentConfigId(null);
      }
    } catch (error) {
      console.error('Failed to load fees configuration', error);
    }
  };

  const loadAllConfigs = async () => {
    setLoading(true);
    try {
      const configs = await getFeesConfig();
      setAllConfigs(configs || []);
      setHasGlobalConfig((configs || []).some((c: any) => c.targetType === 'GLOBAL'));
    } catch (error) {
      console.error('Failed to load all configurations', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = async (tabId: string) => {
    const type = tabId as 'PRODUCT' | 'CATEGORY' | 'GLOBAL' | 'OVERVIEW';
    setActiveTab(type);
    setLoading(true);
    setSelectedId('');
    if (type === 'GLOBAL') {
      await loadFees('GLOBAL');
    } else if (type === 'OVERVIEW') {
      await loadAllConfigs();
    } else {
      setFeesConfig([]);
    }
    setLoading(false);
  };

  const handleSelectionChange = async (id: string) => {
    setSelectedId(id);
    setLoading(true);
    await loadFees(activeTab as any, id);
    setLoading(false);
  };

  const toggleFee = (optionId: string, enabled: boolean) => {
    setFeesConfig(prev => {
      const existing = prev.find(f => f.optionId === optionId);
      if (existing) {
        return prev.map(f => f.optionId === optionId ? { ...f, enabled } : f);
      } else {
        return [...prev, { optionId, enabled, type: 'FIXED', value: 0 }];
      }
    });
  };

  const addCustomFee = () => {
    const newId = `custom_${Date.now()}`;
    setFeesConfig(prev => [
      ...prev,
      { optionId: newId, enabled: true, type: 'FIXED', value: 0, label: 'New Custom Fee' }
    ]);
  };

  const removeCustomFee = (optionId: string) => {
    setFeesConfig(prev => prev.filter(f => f.optionId !== optionId));
  };

  const updateFeeConfig = (optionId: string, updates: Partial<FeeConfig>) => {
    setFeesConfig(prev => {
      const existing = prev.find(f => f.optionId === optionId);
      if (existing) {
        return prev.map(f => f.optionId === optionId ? { ...f, ...updates } : f);
      } else {
        return [...prev, { optionId, enabled: true, type: 'FIXED', value: 0, ...updates }];
      }
    });
  };

  const handleSave = async () => {
    if ((activeTab === 'PRODUCT' || activeTab === 'CATEGORY') && !selectedId) {
      dashboard.showToast({ message: `Please select a ${activeTab.toLowerCase()} first`, type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await saveFeesConfig({
        targetType: activeTab as any,
        targetId: selectedId || undefined,
        fees: feesConfig.filter(f => f.enabled)
      });
      dashboard.showToast({ message: 'Configuration saved successfully!' });
      if (activeTab === 'GLOBAL') {
        setHasGlobalConfig(true);
      }
    } catch (error) {
      console.error('Failed to save configuration', error);
      dashboard.showToast({ message: 'Failed to save configuration', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this configuration?')) return;

    setDeleting(true);
    try {
      console.log('Attempting to delete config with id:', id);
      await deleteFeesConfig(id);
      dashboard.showToast({ message: 'Configuration deleted successfully!' });
      if (activeTab === 'OVERVIEW') {
        await loadAllConfigs();
      } else {
        if (activeTab === 'GLOBAL') {
          setHasGlobalConfig(false);
        }
        setFeesConfig([]);
        setCurrentConfigId(null);
      }
    } catch (error: any) {
      console.error('Failed to delete configuration', error);
      const errorMessage = error?.message || 'Failed to delete configuration';
      dashboard.showToast({ message: errorMessage, type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const getFeeState = (optionId: string) => {
    return feesConfig.find(f => f.optionId === optionId) || { enabled: false, type: 'FIXED', value: 0 };
  };

  const getTargetName = (item: any) => {
    if (item.targetType === 'GLOBAL') return 'Global Store';
    if (item.targetType === 'CATEGORY') {
      return categories.find(c => c._id === item.targetId)?.name || item.targetId;
    }
    if (item.targetType === 'PRODUCT') {
      return products.find(p => p._id === item.targetId)?.name || item.targetId;
    }
    return 'Unknown';
  };

  const getFeeLabel = (optionId: string) => {
    for (const cat of FEE_CATEGORIES) {
      const opt = cat.options.find(o => o.id === optionId);
      if (opt) return opt.label;
    }
    return optionId;
  };

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header
          title="Additional Fees Management"
          subtitle="Configure additional fees by product, category, or globally."
        />
        <Page.Content>
          <Layout>
            <Cell span={12}>
              <Tabs
                activeId={activeTab}
                onClick={(tab) => handleTabChange(tab.id as string)}
                showDivider={false}
                items={[
                  { id: 'GLOBAL', title: 'Global Fees' },
                  { id: 'CATEGORY', title: 'Category Fees' },
                  { id: 'PRODUCT', title: 'Product Fees' },
                  { id: 'OVERVIEW', title: 'Configurations Overview' }
                ]}
              />
            </Cell>

            {activeTab === 'OVERVIEW' ? (
              <Cell span={12}>
                <Card>
                  <Card.Header title="Saved Configurations" subtitle="An overview of all active additional fees." />
                  <Card.Content>
                    {loading ? (
                      <Box align="center" padding="50px"><Loader /></Box>
                    ) : allConfigs.length === 0 ? (
                      <Box padding="20px" align="center">
                        <Text secondary>No configurations found. Start by adding global or product fees.</Text>
                      </Box>
                    ) : (
                      <Table
                        data={allConfigs}
                        columns={[
                          {
                            title: 'Target',
                            render: (row) => (
                              <Box direction="vertical">
                                <Text weight="bold">{getTargetName(row)}</Text>
                                <Badge size="small" skin={row.targetType === 'GLOBAL' ? 'warning' : 'neutral'}>
                                  {row.targetType}
                                </Badge>
                              </Box>
                            )
                          },
                          {
                            title: 'Active Fees',
                            render: (row) => (
                              <Box direction="vertical" gap="4px">
                                {row.fees.map((f: any) => (
                                  <Box key={f.optionId} gap="8px" verticalAlign="middle">
                                    <Text size="small">• {f.label || getFeeLabel(f.optionId)}</Text>
                                    <Badge size="tiny" skin="success">
                                      {f.type === 'FIXED' ? `$${f.value}` : f.type === 'PERCENTAGE' ? `${f.value}%` : `$${f.value}/item`}
                                    </Badge>
                                  </Box>
                                ))}
                              </Box>
                            )
                          },
                          {
                            title: 'Actions',
                            width: '120px',
                            render: (row) => (
                              <Box gap="8px" verticalAlign="middle">
                                <IconButton
                                  onClick={() => {
                                    handleTabChange(row.targetType);
                                    if (row.targetType !== 'GLOBAL') {
                                      handleSelectionChange(row.targetId);
                                    }
                                  }}
                                >
                                  <Icons.Edit />
                                </IconButton>
                                {deleting ? (
                                  <Box padding="6px">
                                    <Loader size="tiny" />
                                  </Box>
                                ) : (
                                  <IconButton
                                    skin="light"
                                    onClick={() => handleDelete(row._id)}
                                  >
                                    <Icons.Delete />
                                  </IconButton>
                                )}
                              </Box>
                            )
                          }
                        ]}
                      />
                    )}
                  </Card.Content>
                </Card>
              </Cell>
            ) : (
              <>
                <Cell span={12}>
                  <Card>
                    <Card.Header
                      title={activeTab === 'GLOBAL' ? 'Global Settings' : `Select ${activeTab.toLowerCase()}`}
                    />
                    <Card.Content>
                      {hasGlobalConfig && (activeTab === 'CATEGORY' || activeTab === 'PRODUCT') ? (
                        <SectionHelper skin="warning">
                          Global store fees are currently active. Individual {activeTab.toLowerCase()} fees are disabled to prevent conflicts.
                          Delete the Global configuration if you wish to set specific fees.
                        </SectionHelper>
                      ) : (
                        <>
                          {activeTab === 'GLOBAL' && (
                            <SectionHelper skin="standard">
                              Global fees apply to all orders in the store.
                            </SectionHelper>
                          )}
                          {activeTab === 'CATEGORY' && (
                            <FormField label="Select Category">
                              <Dropdown
                                options={categories.map(c => ({ id: c._id, value: c.name }))}
                                selectedId={selectedId}
                                onSelect={(opt) => handleSelectionChange(opt.id as string)}
                                placeholder="Select a category..."
                              />
                            </FormField>
                          )}
                          {activeTab === 'PRODUCT' && (
                            <FormField label="Select Product">
                              <Dropdown
                                options={products.map(p => ({ id: p._id, value: p.name }))}
                                selectedId={selectedId}
                                onSelect={(opt) => handleSelectionChange(opt.id as string)}
                                placeholder="Select a product..."
                              />
                            </FormField>
                          )}
                        </>
                      )}
                    </Card.Content>
                  </Card>
                </Cell>

                {(activeTab === 'GLOBAL' || selectedId) && (
                  <Cell span={12}>
                    {loading ? (
                      <Box align="center" padding="50px"><Loader /></Box>
                    ) : (
                      <Card>
                        <Card.Header title="Additional Fee Options" subtitle="Select and configure the fees for the selection above." />
                        <Card.Content>
                          <Accordion
                            multiple
                            items={[
                              ...FEE_CATEGORIES.map(category => ({
                                title: category.title,
                                initiallyOpen: true,
                                children: (
                                  <Box padding="20px" direction="vertical" gap="24px">
                                    {category.options.map(option => {
                                      const state = getFeeState(option.id);
                                      return (
                                        <Box key={option.id} direction="vertical" gap="12px">
                                          <Box align="space-between" verticalAlign="middle">
                                            <Checkbox
                                              checked={state.enabled}
                                              onChange={e => toggleFee(option.id, e.target.checked)}
                                            >
                                              <Text weight="bold">{option.label}</Text>
                                            </Checkbox>
                                          </Box>

                                          {state.enabled && (
                                            <Box gap="24px" paddingLeft="30px" verticalAlign="bottom">
                                              <FormField label="Fee Type" >
                                                <Dropdown
                                                  options={[
                                                    { id: 'FIXED', value: 'Fixed Amount' },
                                                    { id: 'PERCENTAGE', value: 'Percentage' },
                                                    { id: 'PER_ITEM', value: 'Per Item' }
                                                  ]}
                                                  selectedId={state.type}
                                                  onSelect={(opt) => updateFeeConfig(option.id, { type: opt.id as any })}
                                                />
                                              </FormField>
                                              <FormField
                                                label={state.type === 'PERCENTAGE' ? 'Percentage (%)' : 'Amount'}
                                              >
                                                <NumberInput
                                                  value={state.value}
                                                  onChange={val => updateFeeConfig(option.id, { value: val || 0 })}
                                                  prefix={state.type === 'PERCENTAGE' ? undefined : <Box verticalAlign="middle" display="inline-flex" align="center" paddingRight="4px">$</Box>}
                                                  suffix={state.type === 'PERCENTAGE' ? <Box verticalAlign="middle" display="inline-flex" align="center" paddingLeft="4px">%</Box> : undefined}
                                                />
                                              </FormField>
                                            </Box>
                                          )}
                                        </Box>
                                      );
                                    })}
                                  </Box>
                                )
                              })),
                              {
                                title: '✏️ Custom Additional Fees',
                                initiallyOpen: true,
                                children: (
                                  <Box padding="20px" direction="vertical" gap="24px">
                                    {feesConfig.filter(f => f.optionId.startsWith('custom_')).map(fee => (
                                      <Box key={fee.optionId} direction="vertical" gap="12px" borderBottom="1px solid #eee" paddingBottom="20px">
                                        <Box align="space-between" verticalAlign="middle">
                                          <FormField label="Fee Label">
                                            <Box gap="12px" verticalAlign="middle">
                                              <Checkbox
                                                checked={fee.enabled}
                                                onChange={e => updateFeeConfig(fee.optionId, { enabled: e.target.checked })}
                                              />
                                              <Box flex="1">
                                                <Input
                                                  placeholder="Enter fee name..."
                                                  value={fee.label || ''}
                                                  onChange={e => updateFeeConfig(fee.optionId, { label: e.target.value })}
                                                />
                                              </Box>
                                              <IconButton skin="destructive" size="small" onClick={() => removeCustomFee(fee.optionId)}>
                                                <Icons.Delete />
                                              </IconButton>
                                            </Box>
                                          </FormField>
                                        </Box>

                                        <Box gap="24px" paddingLeft="30px" verticalAlign="bottom">
                                          <FormField label="Fee Type">
                                            <Dropdown
                                              options={[
                                                { id: 'FIXED', value: 'Fixed Amount' },
                                                { id: 'PERCENTAGE', value: 'Percentage' },
                                                { id: 'PER_ITEM', value: 'Per Item' }
                                              ]}
                                              selectedId={fee.type}
                                              onSelect={(opt) => updateFeeConfig(fee.optionId, { type: opt.id as any })}
                                            />
                                          </FormField>
                                          <FormField label={fee.type === 'PERCENTAGE' ? 'Percentage (%)' : 'Amount'}>
                                            <NumberInput
                                              value={fee.value}
                                              onChange={val => updateFeeConfig(fee.optionId, { value: val || 0 })}
                                              prefix={fee.type === 'PERCENTAGE' ? undefined : <Box verticalAlign="middle" display="inline-flex" align="center" paddingRight="4px">$</Box>}
                                              suffix={fee.type === 'PERCENTAGE' ? <Box verticalAlign="middle" display="inline-flex" align="center" paddingLeft="4px">%</Box> : undefined}
                                            />
                                          </FormField>
                                        </Box>
                                      </Box>
                                    ))}
                                    <Box width="200px">
                                      <Button size="small" prefixIcon={<Icons.Add />} onClick={addCustomFee} fullWidth>
                                        Add New Custom Fee
                                      </Button>
                                    </Box>
                                  </Box>
                                )
                              }
                            ]}
                          />
                          <Box marginTop="24px" paddingTop="24px" borderTop="1px solid #ddd" align="right" gap="12px">
                            {currentConfigId && (
                              <Button
                                skin="destructive"
                                onClick={() => handleDelete(currentConfigId)}
                                disabled={deleting || saving}
                                prefixIcon={deleting ? <Box verticalAlign="middle" display="inline-flex"><Loader size="tiny" /></Box> : <Icons.Delete />}
                              >
                                {deleting ? 'Deleting...' : 'Delete Configuration'}
                              </Button>
                            )}
                            <Button
                              onClick={handleSave}
                              disabled={saving || deleting}
                              prefixIcon={saving ? <Box verticalAlign="middle" display="inline-flex"><Loader size="tiny" /></Box> : <Icons.Saved />}
                            >
                              {saving
                                ? 'Saving Configuration...'
                                : `Save ${activeTab === 'GLOBAL' ? 'Global' : activeTab === 'CATEGORY' ? 'Category' : 'Product'} Configuration`
                              }
                            </Button>
                          </Box>
                        </Card.Content>
                      </Card>
                    )}
                  </Cell>
                )}
              </>
            )}
          </Layout>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

export default Index;
