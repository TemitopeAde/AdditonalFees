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
import {
  getAllProducts,
  getAllStoreCategories,
  saveFeesConfig,
  getFeesConfig,
  deleteFeesConfig,
  isPremiumUser
} from '../../backend/my-web-method.web';

const APP_ID = '56d969fd-3013-43ba-b5e0-a70d0051f235';

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
  const [billingStatus, setBillingStatus] = useState<{
    isFree: boolean;
    planName: string | null;
    freeTrialAvailable: boolean;
    instanceId: string | null;
  } | null>(null);
  const [openingTrial, setOpeningTrial] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Wix reports an eligible, not-yet-started trial as isFree=true and
  // freeTrialAvailable=true. An active trial is reported separately in
  // billing.freeTrialInfo and isFree becomes false.
  const showFreeTrialButton =
    billingStatus?.isFree === true && billingStatus.freeTrialAvailable === true;

  const openFreeTrial = async () => {
    setOpeningTrial(true);
    try {
      const instanceId = billingStatus?.instanceId;
      if (!instanceId) throw new Error('No app instance ID was returned');

      const url = `https://www.wix.com/apps/upgrade/${APP_ID}?appInstanceId=${encodeURIComponent(instanceId)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Failed to open free trial checkout', error);
      dashboard.showToast({ message: 'Unable to open the free trial checkout', type: 'error' });
    } finally {
      setOpeningTrial(false);
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes, billingRes] = await Promise.all([
        getAllProducts(),
        getAllStoreCategories(),
        isPremiumUser()
      ]);
      setBillingStatus({
        isFree: !!(billingRes as any)?.isFree,
        planName: (billingRes as any)?.planName || null,
        freeTrialAvailable: !!(billingRes as any)?.freeTrialAvailable,
        instanceId: (billingRes as any)?.instance?.instanceId || null
      });
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

  // Get label for a fee option from FEE_CATEGORIES
  const getFeeOptionLabel = (optionId: string): string => {
    for (const category of FEE_CATEGORIES) {
      const option = category.options.find(o => o.id === optionId);
      if (option) return option.label;
    }
    return optionId; // Fallback to optionId if not found
  };

  const handleSave = async () => {
    if ((activeTab === 'PRODUCT' || activeTab === 'CATEGORY') && !selectedId) {
      dashboard.showToast({ message: `Please select a ${activeTab.toLowerCase()} first`, type: 'error' });
      return;
    }

    // Validate that enabled fees have a value greater than 0
    const enabledFees = feesConfig.filter(f => f.enabled);
    const invalidFees = enabledFees.filter(f => !f.value || f.value <= 0);

    if (invalidFees.length > 0) {
      dashboard.showToast({
        message: 'All enabled fees must have a value greater than 0',
        type: 'error'
      });
      return;
    }

    // Add label to each fee before saving
    const feesWithLabels = enabledFees.map(fee => ({
      ...fee,
      label: fee.label || getFeeOptionLabel(fee.optionId)
    }));

    setSaving(true);
    try {
      await saveFeesConfig({
        targetType: activeTab as any,
        targetId: selectedId || undefined,
        fees: feesWithLabels
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

  const handleDelete = async (targetType: 'PRODUCT' | 'CATEGORY' | 'GLOBAL', targetId?: string) => {
    if (!window.confirm('Are you sure you want to delete this configuration?')) return;

    setDeleting(true);
    try {
      console.log('Attempting to delete config:', targetType, targetId);
      await deleteFeesConfig(targetType, targetId);
      dashboard.showToast({ message: 'Configuration deleted successfully!' });
      if (activeTab === 'OVERVIEW') {
        await loadAllConfigs();
      } else {
        if (targetType === 'GLOBAL') {
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

  // Check if all options in a category are enabled
  const isCategoryAllChecked = (categoryOptions: { id: string }[]) => {
    return categoryOptions.every(option => getFeeState(option.id).enabled);
  };

  // Check if some (but not all) options in a category are enabled
  const isCategorySomeChecked = (categoryOptions: { id: string }[]) => {
    const checkedCount = categoryOptions.filter(option => getFeeState(option.id).enabled).length;
    return checkedCount > 0 && checkedCount < categoryOptions.length;
  };

  // Toggle all options in a category
  const toggleCategoryFees = (categoryOptions: { id: string }[], enabled: boolean) => {
    setFeesConfig(prev => {
      let updated = [...prev];
      categoryOptions.forEach(option => {
        const existing = updated.find(f => f.optionId === option.id);
        if (existing) {
          updated = updated.map(f => f.optionId === option.id ? { ...f, enabled } : f);
        } else {
          updated.push({ optionId: option.id, enabled, type: 'FIXED', value: 0 });
        }
      });
      return updated;
    });
  };

  // Check if all custom fees are enabled
  const isCustomFeesAllChecked = () => {
    const customFees = feesConfig.filter(f => f.optionId.startsWith('custom_'));
    return customFees.length > 0 && customFees.every(f => f.enabled);
  };

  // Check if some custom fees are enabled
  const isCustomFeesSomeChecked = () => {
    const customFees = feesConfig.filter(f => f.optionId.startsWith('custom_'));
    const checkedCount = customFees.filter(f => f.enabled).length;
    return checkedCount > 0 && checkedCount < customFees.length;
  };

  // Toggle all custom fees
  const toggleAllCustomFees = (enabled: boolean) => {
    setFeesConfig(prev => prev.map(f =>
      f.optionId.startsWith('custom_') ? { ...f, enabled } : f
    ));
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
            {showFreeTrialButton && (
              <Cell span={12}>
                <SectionHelper
                  skin="warning"
                  actionText={openingTrial ? 'Opening Free Trial...' : 'Start Free Trial'}
                  onAction={openingTrial ? undefined : openFreeTrial}
                >
                  Additional prices will not be applied in cart or checkout until you start a free trial or upgrade.
                </SectionHelper>
              </Cell>
            )}
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
                                    onClick={() => handleDelete(row.targetType, row.targetId)}
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
                                title: (
                                  <Box gap="12px" verticalAlign="middle">
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <Checkbox
                                        checked={isCategoryAllChecked(category.options)}
                                        indeterminate={isCategorySomeChecked(category.options)}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleCategoryFees(category.options, e.target.checked);
                                        }}
                                      />
                                    </div>
                                    <Text weight="bold">{category.title}</Text>
                                  </Box>
                                ),
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
                                                  min={0}
                                                  onChange={val => {
                                                    const newVal = typeof val === 'number' ? Math.max(0, val) : 0;
                                                    updateFeeConfig(option.id, { value: newVal });
                                                  }}
                                                  onBlur={() => {
                                                    if (state.value < 0) updateFeeConfig(option.id, { value: 0 });
                                                  }}
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
                                title: (
                                  <Box gap="12px" verticalAlign="middle">
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <Checkbox
                                        checked={feesConfig.filter(f => f.optionId.startsWith('custom_')).length > 0 && isCustomFeesAllChecked()}
                                        indeterminate={feesConfig.filter(f => f.optionId.startsWith('custom_')).length > 0 && isCustomFeesSomeChecked()}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          toggleAllCustomFees(e.target.checked);
                                        }}
                                        disabled={feesConfig.filter(f => f.optionId.startsWith('custom_')).length === 0}
                                      />
                                    </div>
                                    <Text weight="bold">✏️ Custom Additional Fees</Text>
                                  </Box>
                                ),
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
                                              min={0}
                                              onChange={val => {
                                                const newVal = typeof val === 'number' ? Math.max(0, val) : 0;
                                                updateFeeConfig(fee.optionId, { value: newVal });
                                              }}
                                              onBlur={() => {
                                                if (fee.value < 0) updateFeeConfig(fee.optionId, { value: 0 });
                                              }}
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
                                onClick={() => handleDelete(activeTab as 'PRODUCT' | 'CATEGORY' | 'GLOBAL', selectedId || undefined)}
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
