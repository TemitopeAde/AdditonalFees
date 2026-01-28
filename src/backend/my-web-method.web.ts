import { webMethod, Permissions } from '@wix/web-methods';
import { products, collections, productsV3, catalogVersioning, readOnlyVariantsV3 } from '@wix/stores';
import { auth } from '@wix/essentials';
import { members } from '@wix/members';
import { appInstances } from "@wix/app-management";
import { billing } from "@wix/app-management";
import { categories } from '@wix/categories';
import { currentCart } from '@wix/ecom';
import { items } from '@wix/data';


// DEV MODE FLAG - Set to true to unlock all premium features for testing
// Set this back to false when done testing
const DEV_MODE = true;
const CONFIG_COLLECTION_NAME = '@hi-konsult/products-additonal-fees/ProductsSetup';

const stripRichContent = (content: any): string => {
  if (!content) return '';

  // If it's a string, strip HTML tags
  if (typeof content === 'string') {
    return content.replace(/<[^>]*>/g, '');
  }

  if (content.plain) return content.plain;

  if (Array.isArray(content.nodes)) {
    return content.nodes
      .map((node: any) => {
        if (node.nodes && Array.isArray(node.nodes)) {
          return node.nodes
            .map((child: any) => child.textData?.text || '')
            .join('');
        }
        return '';
      })
      .join('\n');
  }
  return '';
};

export const getCurrentMember = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const member = await members.getCurrentMember({ fieldsets: ['FULL'] });


      return member;
    } catch (error) {
      console.error(error);
    }
  }
)


export const getAllProducts = webMethod(
  Permissions.Anyone,
  async (
    options?: {
      limit?: number;
      skip?: number;
      collectionId?: string;
    }
  ) => {
    try {
      const limit = options?.limit || 1000; // No limit restriction, default to 1000
      const skip = options?.skip || 0;
      const collectionId = options?.collectionId;

      const elevatedGetCatalogVersion = auth.elevate(catalogVersioning.getCatalogVersion);
      const catalogVersionResponse = await elevatedGetCatalogVersion();



      if (catalogVersionResponse.catalogVersion === 'V3_CATALOG') {
        try {
          const elevatedQueryProducts = auth.elevate(productsV3.queryProducts);

          // Fetch ALL products using cursor-based pagination (V3 API limit: 100 per request)
          const allItems: any[] = [];
          let queryBuilder = (elevatedQueryProducts as any)({
            fields: [
              'DESCRIPTION',
              'PLAIN_DESCRIPTION',
              'MEDIA_ITEMS_INFO',
              'VARIANT_OPTION_CHOICE_NAMES',
              'CURRENCY',
              'URL',
              'ALL_CATEGORIES_INFO',
              'INFO_SECTION',
              'MIN_VARIANT_PRICE_INFO'
            ]
          }).limit(100); // V3 API max limit is 100

          let hasMorePages = true;

          while (hasMorePages) {
            const resultsV3 = await queryBuilder.find();
            allItems.push(...resultsV3.items);

            // Check if there are more pages using cursor
            if (resultsV3.cursors?.next) {
              queryBuilder = queryBuilder.skipTo(resultsV3.cursors.next);
            } else {
              hasMorePages = false;
            }
          }

          let filteredItems = allItems;

          // Filter by collection if provided
          if (collectionId) {
            filteredItems = filteredItems.filter((product: any) =>
              product.allCategoriesInfo?.categories?.some((cat: any) => cat._id === collectionId) ||
              product.categories?.some((cat: any) => cat._id === collectionId)
            );
          }

          // Transform V3 products to match V1 structure
          const transformedItems = filteredItems.map((product: any) => {
            const priceAmount = product.price?.actualPrice?.amount ||
              product.price?.price?.amount ||
              product.actualPriceRange?.minValue?.amount;
            const discountedPriceAmount = product.price?.discountedPrice?.amount ||
              product.actualPriceRange?.minValue?.amount;
            const currencyCode = product.price?.currency ||
              product.currency ||
              product.actualPriceRange?.minValue?.currency;

            const priceData = priceAmount ? {
              price: priceAmount,
              discountedPrice: discountedPriceAmount || priceAmount,
              currency: currencyCode
            } : undefined;

            const price = priceData ? {
              price: priceData.price,
              discountedPrice: priceData.discountedPrice,
              formatted: {
                price: product.price?.price?.formattedAmount || (currencyCode ? `${currencyCode} ${priceData.price}` : `${priceData.price}`),
                discountedPrice: product.price?.discountedPrice?.formattedAmount || (currencyCode ? `${currencyCode} ${priceData.discountedPrice}` : `${priceData.discountedPrice}`)
              }
            } : undefined;
            const productId = typeof product._id === 'object' ? product._id.value || product._id._id : product._id;
            const productName = typeof product.name === 'object' ? product.name.value || product.name.name : product.name;
            const productSlug = typeof product.slug === 'object' ? product.slug.value || product.slug.slug : product.slug;

            // Extract collectionIds from allCategoriesInfo for V3
            const collectionIds = product.allCategoriesInfo?.categories?.map((cat: any) => cat._id) ||
              product.categories?.map((cat: any) => cat._id) ||
              [];

            // Transform media structure from V3 to V1 format
            const transformedMedia = product.media ? {
              mainMedia: {
                image: {
                  url: product.media.main?.image
                }
              },
              items: product.media.itemsInfo?.items || []
            } : undefined;

            // Extract ribbon name from V3 structure
            const ribbonName = product.ribbon?.name;

            // Extract brand from V3 structure
            const brandName = product.brand?.name || product.brand;

            // Extract stock info from V3 structure
            const stockInfo = {
              inStock: (product.inventory?.status === 'IN_STOCK') || (product.stock?.inStock ?? true),
              quantity: product.inventory?.quantity || product.stock?.quantity,
              trackInventory: product.inventory?.trackInventory ?? product.manageVariants ?? false
            };

            // Check if product has a discount
            const hasDiscount = product.price?.discountedPrice &&
              product.price?.price &&
              parseFloat(product.price.discountedPrice) < parseFloat(product.price.price);

            return {
              _id: productId,
              name: productName,
              slug: productSlug,
              description: stripRichContent(product.plainDescription || product.description),
              price: price,
              priceData: priceData,
              media: transformedMedia,
              ribbon: ribbonName,
              brand: brandName,
              sku: product.sku,
              stock: stockInfo,
              hasDiscount: hasDiscount,
              collectionIds: collectionIds,
              categories: product.allCategoriesInfo?.categories || product.categories || [],
              additionalInfoSections: product.additionalInfoSections || product.infoSections || [],
              productOptions: (product.options || product.productOptions || []).map((option: any) => ({
                optionType: option.optionRenderType === 'COLOR_CHOICES' ? 'color' : 'drop_down',
                name: option.name,
                choices: (option.choicesSettings?.choices || option.choices || []).map((choice: any) => ({
                  value: choice.key || choice.name,
                  description: choice.name || choice.key,
                  inStock: choice.inStock ?? true,
                  visible: choice.visible ?? true
                })) || []
              })),
              variants: [] // Variants will be fetched lazily via getProductById when needed
            };
          });

          const paginatedItems = transformedItems.slice(skip, skip + limit);

          return {
            version: 'v3',
            items: paginatedItems,
            hasNext: skip + limit < transformedItems.length,
            hasPrev: skip > 0,
            totalCount: transformedItems.length,
            pageSize: limit,
            currentPage: Math.floor(skip / limit),
          };
        } catch (v3Error) {
          console.warn('V3 catalog query failed, falling back to V1:', v3Error);
        }
      }

      // Use V1 catalog (either explicitly V1 or as fallback)
      const elevatedQueryProducts = auth.elevate(products.queryProducts);

      // Fetch ALL products using V1 pagination with hasNext() and next()
      let allProducts: any[] = [];
      let queryV1 = elevatedQueryProducts().limit(100); // Maximum limit per page

      let resultsV1 = await queryV1.find();
      allProducts = allProducts.concat(resultsV1.items);

      while (resultsV1.hasNext()) {
        resultsV1 = await resultsV1.next();
        allProducts = allProducts.concat(resultsV1.items);
      }

      // Filter by collection if provided
      if (collectionId) {
        allProducts = allProducts.filter((product: any) =>
          product.collectionIds?.includes(collectionId)
        );
      }

      const paginatedItems = allProducts.slice(skip, skip + limit);

      return {
        version: 'v1',
        items: paginatedItems,
        hasNext: skip + limit < allProducts.length,
        hasPrev: skip > 0,
        totalCount: allProducts.length,
        pageSize: limit,
        currentPage: Math.floor(skip / limit),
      };
    } catch (error) {
      console.error('Error querying all products:', error);
      throw new Error('Failed to query products.');
    }
  }
);

const normalizeV3Product = (product: any) => {
  if (!product) return null;

  // Transform V3 options to V1 productOptions format
  const productOptions = (product.options || product.productOptions || []).map((option: any) => ({
    optionType: option.optionRenderType === 'COLOR_CHOICES' ? 'color' : 'drop_down',
    name: option.name,
    choices: (option.choicesSettings?.choices || option.choices || []).map((choice: any) => ({
      value: choice.key || choice.name,
      description: choice.name || choice.key,
      inStock: choice.inStock ?? true,
      visible: choice.visible ?? true,
      media: choice.linkedMedia && choice.linkedMedia.length > 0 ? {
        mainMedia: choice.linkedMedia[0]
      } : undefined
    }))
  }));

  // Transform V3 variants to V1 format
  // Check both variantsInfo.variants (v3 API) and variants (already normalized)
  const variantsSource = product.variantsInfo?.variants || product.variants || [];
  const variants = variantsSource.map((variant: any) => ({
    _id: variant._id,
    visible: variant.visible ?? true,
    inStock: variant.inventoryStatus?.inStock ?? variant.inStock ?? true,
    price: variant.price?.actualPrice?.amount || variant.priceData?.price || product.actualPriceRange?.minValue?.amount,
    formattedPrice: variant.price?.actualPrice?.formattedAmount || variant.priceData?.formatted?.price || product.actualPriceRange?.minValue?.formattedAmount,
    sku: variant.sku,
    choices: variant.choices?.reduce((acc: any, choice: any) => {
      if (choice.optionChoiceNames) {
        acc[choice.optionChoiceNames.optionName] = choice.optionChoiceNames.choiceName;
      }
      return acc;
    }, {}) || {}
  }));

  // Robust price extraction for V3
  const priceAmount = product.price?.actualPrice?.amount ||
    product.price?.price?.amount ||
    product.actualPriceRange?.minValue?.amount;
  const discountedPriceAmount = product.price?.discountedPrice?.amount ||
    product.actualPriceRange?.minValue?.amount;
  const currencyCode = product.price?.currency ||
    product.currency ||
    product.actualPriceRange?.minValue?.currency;

  const priceData = priceAmount ? {
    price: priceAmount,
    discountedPrice: discountedPriceAmount || priceAmount,
    currency: currencyCode
  } : undefined;

  const price = priceData ? {
    price: priceData.price,
    discountedPrice: priceData.discountedPrice,
    formatted: {
      price: product.price?.price?.formattedAmount || (currencyCode ? `${currencyCode} ${priceData.price}` : `${priceData.price}`),
      discountedPrice: product.price?.discountedPrice?.formattedAmount || (currencyCode ? `${currencyCode} ${priceData.discountedPrice}` : `${priceData.discountedPrice}`)
    }
  } : undefined;

  // Add productOptions and normalized variants to the product object
  return {
    ...product,
    description: stripRichContent(product.plainDescription || product.description),
    price,
    priceData,
    productOptions,
    variants,
    manageVariants: variants.length > 0
  };
};


export const getProductById = webMethod(
  Permissions.Anyone,
  async (productId: string) => {
    try {
      // Try V3 first (newest catalog)
      const productV3 = await productsV3.getProduct(productId, {
        fields: [
          'ALL_CATEGORIES_INFO',
          'BREADCRUMBS_INFO',
          'CURRENCY',
          'DESCRIPTION',
          'DIRECT_CATEGORIES_INFO',
          'INFO_SECTION',
          'INFO_SECTION_DESCRIPTION',
          'INFO_SECTION_PLAIN_DESCRIPTION',
          'MEDIA_ITEMS_INFO',
          'PLAIN_DESCRIPTION',
          'SUBSCRIPTION_PRICES_INFO',
          'THUMBNAIL',
          'URL',
          'VARIANT_OPTION_CHOICE_NAMES',
          'WEIGHT_MEASUREMENT_UNIT_INFO',
          'MIN_VARIANT_PRICE_INFO',
        ],
      } as any);

      // Normalize V3 product to include productOptions field
      const normalizedProduct = normalizeV3Product(productV3);

      return {
        version: 'v3',
        product: normalizedProduct,
      };
    } catch (v3Error) {
      console.warn('V3 catalog fetch failed, trying V1:', v3Error);

      try {
        // Fallback to V1 (legacy catalog)
        const productV1 = await products.getProduct(productId, {
          // V1 doesn't have the same fields system, but we can request what's available
        });

        return {
          version: 'v1',
          product: productV1,
        };
      } catch (v1Error) {
        // console.error('Both V3 and V1 catalog fetch failed:', { v3Error, v1Error });
        throw new Error(`Failed to fetch product: V3 error - ${v3Error}, V1 error - ${v1Error}`);
      }
    }
  },
);

export const addToCart = webMethod(
  Permissions.Anyone,
  async (
    productId: string,
    variantId: string | undefined,
    quantity: number,
    choices?: Record<string, string>,
    customTextFields?: Record<string, string>
  ) => {
    try {

      const WIX_STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';
      const catalogOptions: any = {};

      if (variantId) {
        catalogOptions.variantId = variantId;
      }

      if (choices && Object.keys(choices).length > 0) {
        catalogOptions.options = choices;
      }

      if (customTextFields && Object.keys(customTextFields).length > 0) {
        catalogOptions.customTextFields = customTextFields;
      }

      const cartOptions = {
        lineItems: [
          {
            catalogReference: {
              appId: WIX_STORES_APP_ID,
              catalogItemId: productId,
              ...(Object.keys(catalogOptions).length > 0 && { options: catalogOptions }),
            },
            quantity: quantity,
          },
        ],
      };

      const updatedCurrentCart = await currentCart.addToCurrentCart(cartOptions);

      return {
        success: true,
        cart: updatedCurrentCart,
      };
    } catch (error) {
      console.error('Add to cart failed:', error);

      let errorMessage = 'Failed to add to cart. ';
      if (error instanceof Error) {
        errorMessage += error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
);

export const getAppInstance = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
      const response = await elevatedGetAppInstance();

      if (DEV_MODE && response?.instance) {
        response.instance.isFree = false;
        (response as any).dev = true;
      }


      return response;
    } catch (error) {
      console.error('Error fetching instance ID:', error);
    }
  }
);

export const getUpgradeUrl = webMethod(
  Permissions.Anyone,
  async (productId, selectedPlan) => {
    try {
      const elevatedGetUrl = auth.elevate(billing.getUrl);
      const response = await elevatedGetUrl(productId, {
        billingCycle: selectedPlan
      });

      return response;
    } catch (error) {
      console.error('Error fetching upgrade URL:', error);
      throw error;
    }
  }
);

export const isPremiumUser = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const elevatedGetAppInstance = auth.elevate(appInstances.getAppInstance);
      const response = await elevatedGetAppInstance();

      const isFree = !!response?.instance?.isFree;
      const freeTrialAvailable = !!response?.instance?.freeTrialAvailable;

      // Check if there's an active trial by checking the status
      const billing = response?.instance?.billing;
      const trialStatus = billing?.freeTrialInfo?.status;
      const trialEndDate = billing?.freeTrialInfo?.endDate;

      // Trial is active if status is explicitly 'active' or 'ACTIVE'
      const hasActiveTrial = trialStatus?.toLowerCase() === 'active';

      // User is premium if:
      // 1. App is paid (isFree === false), OR
      // 2. There's an active trial (status === 'active'), OR
      // 3. DEV_MODE is enabled
      const isPremium = DEV_MODE || !isFree || hasActiveTrial;

      return {
        isPremium,
        isFree: DEV_MODE ? false : isFree, // Report as not free in dev mode to bypass frontend checks
        hasActiveTrial,
        freeTrialAvailable,
        trialStatus: trialStatus || null,
        trialEndDate: trialEndDate || null,
        instance: response?.instance,
        dev: DEV_MODE // Add dev flag to the response
      };
    } catch (error) {
      console.error('Error checking premium status:', error);
      // Default to free if there's an error
      return {
        isPremium: DEV_MODE, // Still allow premium features in dev mode even on error
        isFree: DEV_MODE ? false : true,
        hasActiveTrial: false,
        freeTrialAvailable: false,
        trialStatus: null,
        trialEndDate: null,
        instance: null,
        dev: DEV_MODE
      };
    }
  }
);

export const getAllStoreCategories = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const elevatedGetCatalogVersion = auth.elevate(catalogVersioning.getCatalogVersion);
      const catalogVersionResponse = await elevatedGetCatalogVersion();
      console.log(catalogVersionResponse);


      if (catalogVersionResponse.catalogVersion === 'V3_CATALOG') {
        try {
          const elevatedQueryCategories = auth.elevate(categories.queryCategories);

          const v3CategoryResult = await elevatedQueryCategories({
            treeReference: {
              appNamespace: "@wix/stores",
              treeKey: null
            }
          })
            .eq('visible', true)
            .find();


          // Transform V3 categories to match V1 structure
          const transformedCategories = (v3CategoryResult.items || []).map((category: any) => {
            // Extract the actual string values from objects if needed
            const categoryId = typeof category._id === 'object' ? category._id.value || category._id._id : category._id;
            const categoryName = typeof category.name === 'object' ? category.name.value || category.name.name : category.name;
            const categorySlug = typeof category.slug === 'object' ? category.slug.value || category.slug.slug : category.slug;

            return {
              _id: categoryId,
              name: categoryName,
              slug: categorySlug,
              visible: category.visible,
              numberOfProducts: category.numberOfProducts || 0
            };
          });

          return transformedCategories;
        } catch (err) {
          console.error('Error fetching V3 categories:', err);
          return [];
        }
      } else {

        const elevatedQueryCollections = auth.elevate(collections.queryCollections);
        const response = await elevatedQueryCollections().find();

        const collectionsWithCounts = await Promise.all(
          response.items.map(async (collection) => {
            try {
              if (collection._id) {
                const elevatedQueryProducts = auth.elevate(products.queryProducts);

                // Fetch all products and filter manually since collectionIds field is not queryable
                let allProducts: any[] = [];
                let queryV1 = elevatedQueryProducts().limit(100);

                let resultsV1 = await queryV1.find();
                allProducts = allProducts.concat(resultsV1.items);

                while (resultsV1.hasNext()) {
                  resultsV1 = await resultsV1.next();
                  allProducts = allProducts.concat(resultsV1.items);
                }

                // Filter products by collection manually
                const filteredProducts = allProducts.filter((product: any) =>
                  product.collectionIds?.includes(collection._id)
                );

                return {
                  ...collection,
                  numberOfProducts: filteredProducts.length,
                };
              }
              return collection;
            } catch (error) {
              console.error(`Error counting products for collection ${collection._id}:`, error);
              return collection;
            }
          })
        );

        return collectionsWithCounts;
      }
    } catch (error) {
      console.error('Error in getAllStoreCategories:', error);
      return []; // Return empty array instead of throwing
    }
  }
);

export const getProductsByCollection = webMethod(
  Permissions.Anyone,
  async (
    collectionId: string,
    options?: {
      limit?: number;
      skip?: number;
      minPrice?: number;
      maxPrice?: number;
    }
  ) => {
    try {
      const limit = options?.limit || 1000;
      const skip = options?.skip || 0;

      const elevatedGetCatalogVersion = auth.elevate(catalogVersioning.getCatalogVersion);
      const catalogVersionResponse = await elevatedGetCatalogVersion();

      if (catalogVersionResponse.catalogVersion === 'V3_CATALOG') {
        try {
          const elevatedQueryProducts = auth.elevate(productsV3.queryProducts);

          // Fetch ALL products using cursor-based pagination (V3 API limit: 100 per request)
          const allFilteredItems: any[] = [];
          let queryBuilder = (elevatedQueryProducts as any)({
            fields: [
              'DESCRIPTION',
              'PLAIN_DESCRIPTION',
              'MEDIA_ITEMS_INFO',
              'VARIANT_OPTION_CHOICE_NAMES',
              'CURRENCY',
              'URL',
              'ALL_CATEGORIES_INFO',
              'INFO_SECTION',
              'MIN_VARIANT_PRICE_INFO'
            ]
          }).limit(100); // V3 API max limit is 100

          let hasMorePages = true;

          while (hasMorePages) {
            const resultsV3 = await queryBuilder.find();

            // Filter products by collection
            const filteredBatch = resultsV3.items.filter((product: any) =>
              product.allCategoriesInfo?.categories?.some((cat: any) => cat._id === collectionId) ||
              product.categories?.some((cat: any) => cat._id === collectionId)
            );

            allFilteredItems.push(...filteredBatch);

            // Check if there are more pages using cursor
            if (resultsV3.cursors?.next) {
              queryBuilder = queryBuilder.skipTo(resultsV3.cursors.next);
            } else {
              hasMorePages = false;
            }
          }

          // Transform V3 products to match V1 structure
          const transformedItems = allFilteredItems
            .map((product: any) => {
              const priceAmount = product.price?.actualPrice?.amount ||
                product.price?.price?.amount ||
                product.actualPriceRange?.minValue?.amount;
              const discountedPriceAmount = product.price?.discountedPrice?.amount ||
                product.actualPriceRange?.minValue?.amount;
              const currencyCode = product.price?.currency ||
                product.currency ||
                product.actualPriceRange?.minValue?.currency;

              const priceData = priceAmount ? {
                price: priceAmount,
                discountedPrice: discountedPriceAmount || priceAmount,
                currency: currencyCode
              } : undefined;

              const price = priceData ? {
                price: priceData.price,
                discountedPrice: priceData.discountedPrice,
                formatted: {
                  price: product.price?.price?.formattedAmount || (currencyCode ? `${currencyCode} ${priceData.price}` : `${priceData.price}`),
                  discountedPrice: product.price?.discountedPrice?.formattedAmount || (currencyCode ? `${currencyCode} ${priceData.discountedPrice}` : `${priceData.discountedPrice}`)
                }
              } : undefined;

              const productId = typeof product._id === 'object' ? product._id.value || product._id._id : product._id;
              const productName = typeof product.name === 'object' ? product.name.value || product.name.name : product.name;
              const productSlug = typeof product.slug === 'object' ? product.slug.value || product.slug.slug : product.slug;

              // Extract collectionIds from allCategoriesInfo for V3
              const collectionIds = product.allCategoriesInfo?.categories?.map((cat: any) => cat._id) ||
                product.categories?.map((cat: any) => cat._id) ||
                [];

              // Transform media structure from V3 to V1 format
              const transformedMedia = product.media ? {
                mainMedia: {
                  image: {
                    url: product.media.main?.image
                  }
                },
                items: product.media.itemsInfo?.items || []
              } : undefined;

              // Extract ribbon name from V3 structure
              const ribbonName = product.ribbon?.name;

              // Transform V3 options to V1 productOptions format
              const productOptions = (product.options || product.productOptions || []).map((option: any) => ({
                optionType: option.optionRenderType === 'COLOR_CHOICES' ? 'color' : 'drop_down',
                name: option.name,
                choices: (option.choicesSettings?.choices || option.choices || []).map((choice: any) => ({
                  value: choice.key || choice.name,
                  description: choice.name || choice.key,
                  inStock: choice.inStock ?? true,
                  visible: choice.visible ?? true
                })) || []
              }));

              return {
                _id: productId,
                name: productName,
                slug: productSlug,
                description: stripRichContent(product.plainDescription || product.description),
                price: price,
                priceData: priceData,
                media: transformedMedia,
                ribbon: ribbonName,
                collectionIds: collectionIds,
                categories: product.allCategoriesInfo?.categories || product.categories || [],
                productOptions: productOptions
              };
            })
            .filter((product: any) => {
              // Apply price filtering if minPrice or maxPrice is provided
              if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
                const price = product.priceData?.discountedPrice ?? product.priceData?.price ?? product.price?.discountedPrice ?? product.price?.price ?? 0;

                if (options?.minPrice !== undefined && price < options.minPrice) {
                  return false;
                }
                if (options?.maxPrice !== undefined && price > options.maxPrice) {
                  return false;
                }
              }
              return true;
            });

          const paginatedItems = transformedItems.slice(skip, skip + limit);

          return {
            version: 'v3',
            items: paginatedItems,
            hasNext: skip + limit < transformedItems.length,
            hasPrev: skip > 0,
            totalCount: transformedItems.length,
            pageSize: limit,
            currentPage: Math.floor(skip / limit),
            pagination: {
              hasNext: skip + limit < transformedItems.length,
              hasPrev: skip > 0,
              nextSkip: skip + limit < transformedItems.length ? skip + limit : null,
              prevSkip: skip > 0 ? Math.max(0, skip - limit) : null,
            },
          };
        } catch (v3Error) {
          console.warn('V3 catalog query failed, falling back to V1:', v3Error);
          // Fall through to V1 implementation
        }
      }

      const elevatedQueryProducts = auth.elevate(products.queryProducts);

      // Fetch ALL products using V1 pagination with hasNext() and next()
      let allProducts: any[] = [];
      let queryV1 = elevatedQueryProducts().limit(100); // Maximum limit per page

      let resultsV1 = await queryV1.find();
      allProducts = allProducts.concat(resultsV1.items);

      while (resultsV1.hasNext()) {
        resultsV1 = await resultsV1.next();
        allProducts = allProducts.concat(resultsV1.items);
      }

      // Filter products by collection manually
      allProducts = allProducts.filter((product: any) =>
        product.collectionIds?.includes(collectionId)
      );

      // Apply price filtering if minPrice or maxPrice is provided
      let filteredProducts = allProducts;
      if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
        filteredProducts = allProducts.filter((product: any) => {
          const price = product.priceData?.discountedPrice ?? product.priceData?.price ?? product.price?.discountedPrice ?? product.price?.price ?? 0;

          if (options?.minPrice !== undefined && price < options.minPrice) {
            return false;
          }
          if (options?.maxPrice !== undefined && price > options.maxPrice) {
            return false;
          }
          return true;
        });
      }

      const paginatedItems = filteredProducts.slice(skip, skip + limit);

      return {
        version: 'v1',
        items: paginatedItems,
        hasNext: skip + limit < filteredProducts.length,
        hasPrev: skip > 0,
        totalCount: filteredProducts.length,
        pageSize: limit,
        currentPage: Math.floor(skip / limit),
        pagination: {
          hasNext: skip + limit < filteredProducts.length,
          hasPrev: skip > 0,
          nextSkip: skip + limit < filteredProducts.length ? skip + limit : null,
          prevSkip: skip > 0 ? Math.max(0, skip - limit) : null,
        },
      };
    } catch (error) {
      console.error('Error querying products by collection:', error);
      throw new Error('Failed to query products by collection.');
    }
  }
);

export const saveFeesConfig = webMethod(
  Permissions.Anyone,
  async (config: { targetType: 'PRODUCT' | 'CATEGORY' | 'GLOBAL', targetId?: string, fees: any[] }) => {
    try {
      // Find existing item by targetType and targetId
      let query = items.query(CONFIG_COLLECTION_NAME).eq("targetType", config.targetType);
      if (config.targetId) {
        query = query.eq("targetId", config.targetId);
      }

      const { items: existingItems } = await query.find();

      const existingItem = existingItems && existingItems.length > 0 ? existingItems[0] : null;
      await items.save(CONFIG_COLLECTION_NAME, {
        _id: existingItem?._id,
        targetType: config.targetType,
        targetId: config.targetId || 'GLOBAL',
        fees: JSON.stringify(config.fees),
        updatedDate: new Date().toISOString(),
        ...(existingItem ? {} : { createdDate: new Date().toISOString() })
      })
      return { success: true };
    } catch (error) {
      console.error('Error saving fees config:', error);
      throw new Error('Failed to save fees config');
    }
  }
);

export const getFeesConfig = webMethod(
  Permissions.Anyone,
  async (targetType?: 'PRODUCT' | 'CATEGORY' | 'GLOBAL', targetId?: string) => {
    try {
      let query = items.query(CONFIG_COLLECTION_NAME);

      if (targetType) {
        query = query.eq("targetType", targetType);
      }
      if (targetId) {
        query = query.eq("targetId", targetId);
      }

      const { items: resultItems } = await query.find();

      return (resultItems || []).map((item: any) => ({
        _id: item._id,
        ...item,
        fees: item.fees ? JSON.parse(item.fees as string) : []
      }));
    } catch (error) {
      console.error('Error fetching fees config:', error);
      return [];
    }
  }
);

export const deleteFeesConfig = webMethod(
  Permissions.Anyone,
  async (id: string) => {
    try {
      const elevatedRemove = auth.elevate(items.remove);
      await elevatedRemove(CONFIG_COLLECTION_NAME, id);
      return { success: true };
    } catch (error) {
      console.error('Error deleting fees config:', error);
      throw new Error(`Failed to delete fees config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
