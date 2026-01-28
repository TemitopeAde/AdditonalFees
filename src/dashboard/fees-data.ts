export const FEE_CATEGORIES = [
    {
        id: 'packaging_handling',
        title: '📦 Packaging & Handling',
        options: [
            { id: 'premium_packaging', label: 'Premium packaging fee' },
            { id: 'oversized_item', label: 'Oversized item handling fee' },
            { id: 'temp_controlled', label: 'Temperature-controlled packaging fee' },
            { id: 'waterproof', label: 'Waterproof packaging fee' },
            { id: 'anti_tamper', label: 'Anti-tamper seal fee' },
            { id: 'custom_branding', label: 'Custom box branding fee' },
        ]
    },
    {
        id: 'delivery_logistics',
        title: '🚚 Delivery & Logistics',
        options: [
            { id: 'same_day', label: 'Same-day delivery fee' },
            { id: 'express_shipping', label: 'Express shipping upgrade fee' },
            { id: 'remote_area', label: 'Remote area delivery fee' },
            { id: 'weekend_holiday', label: 'Weekend / holiday delivery fee' },
            { id: 'scheduled_timeslot', label: 'Scheduled time-slot delivery fee' },
            { id: 'heavy_item', label: 'Heavy item transport fee' },
            { id: 'stair_carry', label: 'Stair carry / lift-gate service fee' },
        ]
    },
    {
        id: 'product_service_addons',
        title: '🛠 Product & Service Add-Ons',
        options: [
            { id: 'assembly', label: 'Assembly fee' },
            { id: 'installation', label: 'Installation fee' },
            { id: 'configuration', label: 'Configuration / setup fee' },
            { id: 'calibration', label: 'Calibration fee' },
            { id: 'personalization', label: 'Engraving / personalization fee' },
            { id: 'quality_cert', label: 'Quality inspection certificate fee' },
            { id: 'authentication', label: 'Authentication / verification fee' },
        ]
    },
    {
        id: 'protection_insurance',
        title: '🛡 Protection & Insurance',
        options: [
            { id: 'theft_protection', label: 'Theft protection fee' },
            { id: 'damage_protection', label: 'Damage protection plan' },
            { id: 'return_protection', label: 'Return protection fee' },
            { id: 'accidental_coverage', label: 'Accidental coverage fee' },
            { id: 'extended_support', label: 'Extended support plan' },
            { id: 'priority_support', label: 'Priority support fee' },
        ]
    },
    {
        id: 'gifting_experience',
        title: '🎁 Gifting & Experience',
        options: [
            { id: 'greeting_card', label: 'Greeting card fee' },
            { id: 'video_message', label: 'Video message inclusion fee' },
            { id: 'decoration', label: 'Premium ribbon / decoration fee' },
            { id: 'surprise_packaging', label: 'Surprise packaging fee' },
            { id: 'event_delivery', label: 'Event delivery coordination fee' },
        ]
    },
    {
        id: 'environmental_compliance',
        title: '🌱 Environmental & Compliance',
        options: [
            { id: 'recycling', label: 'Recycling service fee' },
            { id: 'eco_donation', label: 'Eco-donation fee' },
            { id: 'sustainable_sourcing', label: 'Sustainable sourcing fee' },
            { id: 'regulatory_compliance', label: 'Regulatory compliance fee' },
            { id: 'import_doc', label: 'Import documentation fee' },
        ]
    },
    {
        id: 'payment_processing',
        title: '💳 Payment & Processing',
        options: [
            { id: 'installment', label: 'Installment processing fee' },
            { id: 'cod', label: 'Cash on delivery fee' },
            { id: 'currency_conversion', label: 'Currency conversion fee' },
            { id: 'fraud_protection', label: 'Fraud protection fee' },
            { id: 'high_risk_surcharge', label: 'High-risk transaction surcharge' },
        ]
    },
    {
        id: 'administrative',
        title: '🧾 Administrative',
        options: [
            { id: 'invoice_reissue', label: 'Invoice reissue fee' },
            { id: 'manual_processing', label: 'Manual order processing fee' },
            { id: 'custom_paperwork', label: 'Custom paperwork fee' },
            { id: 'export_doc', label: 'Export documentation fee' },
            { id: 'customs_brokerage', label: 'Customs brokerage fee' },
        ]
    }
];

export type FeeType = 'FIXED' | 'PERCENTAGE' | 'PER_ITEM';

export interface FeeConfig {
    optionId: string;
    enabled: boolean;
    type: FeeType;
    value: number;
    label?: string;
}

export interface ProductFeesConfig {
    productId: string;
    fees: FeeConfig[];
}
