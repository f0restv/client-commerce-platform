import { PrismaClient, UserRole, ClientStatus, SourceType, ProductStatus, ListingType, MetalType } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Clean existing data (in reverse order of dependencies)
  console.log('🧹 Cleaning existing data...')
  await prisma.productImage.deleteMany()
  await prisma.priceHistory.deleteMany()
  await prisma.marketAnalysis.deleteMany()
  await prisma.platformListing.deleteMany()
  await prisma.watchlistItem.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.bid.deleteMany()
  await prisma.auction.deleteMany()
  await prisma.product.deleteMany()
  await prisma.submissionImage.deleteMany()
  await prisma.submission.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.scrapeHistory.deleteMany()
  await prisma.clientSource.deleteMany()
  await prisma.clientPayout.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.address.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()
  await prisma.client.deleteMany()
  await prisma.category.deleteMany()
  await prisma.metalPrice.deleteMany()
  await prisma.setting.deleteMany()

  // ==================== CATEGORIES ====================
  console.log('📁 Creating categories...')

  const categories = await Promise.all([
    // Parent categories
    prisma.category.create({
      data: {
        name: 'Coins',
        slug: 'coins',
        description: 'Collectible and bullion coins',
        order: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Bullion',
        slug: 'bullion',
        description: 'Precious metal bars and rounds',
        order: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Paper Money',
        slug: 'paper-money',
        description: 'Currency notes and bills',
        order: 3,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Collectibles',
        slug: 'collectibles',
        description: 'Numismatic collectibles and accessories',
        order: 4,
      },
    }),
  ])

  const [coinsCategory, bullionCategory, paperMoneyCategory, collectiblesCategory] = categories

  // Child categories
  const childCategories = await Promise.all([
    // Coins subcategories
    prisma.category.create({
      data: {
        name: 'US Coins',
        slug: 'us-coins',
        description: 'United States coinage',
        parentId: coinsCategory.id,
        order: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: 'World Coins',
        slug: 'world-coins',
        description: 'International coinage',
        parentId: coinsCategory.id,
        order: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Ancient Coins',
        slug: 'ancient-coins',
        description: 'Ancient and medieval coinage',
        parentId: coinsCategory.id,
        order: 3,
      },
    }),
    // Bullion subcategories
    prisma.category.create({
      data: {
        name: 'Gold Bars',
        slug: 'gold-bars',
        description: 'Gold bullion bars',
        parentId: bullionCategory.id,
        order: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Silver Bars',
        slug: 'silver-bars',
        description: 'Silver bullion bars',
        parentId: bullionCategory.id,
        order: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Rounds',
        slug: 'rounds',
        description: 'Precious metal rounds',
        parentId: bullionCategory.id,
        order: 3,
      },
    }),
    // Paper Money subcategories
    prisma.category.create({
      data: {
        name: 'US Currency',
        slug: 'us-currency',
        description: 'United States paper money',
        parentId: paperMoneyCategory.id,
        order: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: 'World Currency',
        slug: 'world-currency',
        description: 'International paper money',
        parentId: paperMoneyCategory.id,
        order: 2,
      },
    }),
  ])

  const [usCoins, worldCoins, ancientCoins, goldBars, silverBars, rounds, usCurrency, worldCurrency] = childCategories

  // ==================== CLIENTS ====================
  console.log('🏢 Creating clients...')

  const clients = await Promise.all([
    prisma.client.create({
      data: {
        name: 'Heritage Coin Gallery',
        slug: 'heritage-coin-gallery',
        email: 'contact@heritagecoingallery.com',
        phone: '(555) 123-4567',
        address: '123 Main Street',
        city: 'Dallas',
        state: 'TX',
        zip: '75201',
        website: 'https://heritagecoingallery.com',
        commissionRate: 12.5,
        status: ClientStatus.ACTIVE,
        notes: 'Long-term client specializing in rare US coins',
        totalItems: 45,
        totalSold: 28,
        totalEarnings: 15420.50,
      },
    }),
    prisma.client.create({
      data: {
        name: 'Silver Stack Investments',
        slug: 'silver-stack-investments',
        email: 'info@silverstackinv.com',
        phone: '(555) 234-5678',
        address: '456 Commerce Ave',
        city: 'Denver',
        state: 'CO',
        zip: '80202',
        website: 'https://silverstackinv.com',
        commissionRate: 15.0,
        status: ClientStatus.ACTIVE,
        notes: 'Bullion dealer with focus on silver products',
        totalItems: 120,
        totalSold: 85,
        totalEarnings: 42300.00,
      },
    }),
    prisma.client.create({
      data: {
        name: 'Vintage Currency Co',
        slug: 'vintage-currency-co',
        email: 'sales@vintagecurrency.co',
        phone: '(555) 345-6789',
        address: '789 Antique Row',
        city: 'Philadelphia',
        state: 'PA',
        zip: '19103',
        commissionRate: 18.0,
        status: ClientStatus.ACTIVE,
        notes: 'Specializes in rare paper money and obsolete currency',
        totalItems: 32,
        totalSold: 15,
        totalEarnings: 8750.00,
      },
    }),
    prisma.client.create({
      data: {
        name: 'Ancient Treasures Ltd',
        slug: 'ancient-treasures-ltd',
        email: 'curator@ancienttreasures.ltd',
        phone: '(555) 456-7890',
        address: '321 Museum Way',
        city: 'Boston',
        state: 'MA',
        zip: '02108',
        commissionRate: 20.0,
        status: ClientStatus.PENDING,
        notes: 'New client - pending verification of ancient coin authenticity',
        totalItems: 0,
        totalSold: 0,
        totalEarnings: 0,
      },
    }),
    prisma.client.create({
      data: {
        name: 'Midwest Gold Exchange',
        slug: 'midwest-gold-exchange',
        email: 'trade@midwestgold.com',
        phone: '(555) 567-8901',
        address: '555 Trading Floor',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        website: 'https://midwestgold.com',
        commissionRate: 10.0,
        status: ClientStatus.PAUSED,
        notes: 'Account paused - awaiting updated business license',
        totalItems: 18,
        totalSold: 12,
        totalEarnings: 28900.00,
      },
    }),
  ])

  const [heritageClient, silverStackClient, vintageCurrencyClient, ancientTreasuresClient, midwestGoldClient] = clients

  // ==================== CLIENT SOURCES ====================
  console.log('🔗 Creating client sources...')

  await Promise.all([
    prisma.clientSource.create({
      data: {
        clientId: heritageClient.id,
        name: 'Main Website',
        type: SourceType.WEBSITE,
        url: 'https://heritagecoingallery.com/inventory',
        isActive: true,
        scrapeFrequency: 60,
        selectors: {
          productList: '.product-grid .product-item',
          title: '.product-title',
          price: '.product-price',
          image: '.product-image img',
        },
      },
    }),
    prisma.clientSource.create({
      data: {
        clientId: heritageClient.id,
        name: 'eBay Store',
        type: SourceType.EBAY_STORE,
        url: 'https://www.ebay.com/str/heritagecoingallery',
        isActive: true,
        scrapeFrequency: 30,
      },
    }),
    prisma.clientSource.create({
      data: {
        clientId: silverStackClient.id,
        name: 'Shopify Store',
        type: SourceType.SHOPIFY,
        url: 'https://silverstackinv.myshopify.com',
        isActive: true,
        scrapeFrequency: 45,
        config: { apiKey: 'placeholder_key' },
      },
    }),
    prisma.clientSource.create({
      data: {
        clientId: vintageCurrencyClient.id,
        name: 'Inventory CSV',
        type: SourceType.CSV_IMPORT,
        url: 'manual://csv-upload',
        isActive: true,
        scrapeFrequency: 0,
      },
    }),
    prisma.clientSource.create({
      data: {
        clientId: midwestGoldClient.id,
        name: 'HiBid Auctions',
        type: SourceType.HIBID,
        url: 'https://hibid.com/auction/midwestgold',
        isActive: false,
        scrapeFrequency: 120,
        lastError: 'Account paused - scraping disabled',
      },
    }),
  ])

  // ==================== USERS ====================
  console.log('👤 Creating users...')

  const hashedPassword = await hash('password123', 12)

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@coinshop.com',
        password: hashedPassword,
        role: UserRole.ADMIN,
        emailVerified: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        name: 'Staff Member',
        email: 'staff@coinshop.com',
        password: hashedPassword,
        role: UserRole.STAFF,
        emailVerified: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        name: 'John Heritage',
        email: 'john@heritagecoingallery.com',
        password: hashedPassword,
        role: UserRole.CLIENT,
        clientId: heritageClient.id,
        emailVerified: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        name: 'Sarah Silver',
        email: 'sarah@silverstackinv.com',
        password: hashedPassword,
        role: UserRole.CLIENT,
        clientId: silverStackClient.id,
        emailVerified: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        name: 'Mike Buyer',
        email: 'mike.buyer@email.com',
        password: hashedPassword,
        role: UserRole.BUYER,
        emailVerified: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        name: 'Lisa Collector',
        email: 'lisa.collector@email.com',
        password: hashedPassword,
        role: UserRole.BUYER,
        emailVerified: new Date(),
      },
    }),
  ])

  const [adminUser, staffUser, heritageUser, silverUser, buyerMike, buyerLisa] = users

  // ==================== ADDRESSES ====================
  console.log('📍 Creating addresses...')

  await Promise.all([
    prisma.address.create({
      data: {
        userId: buyerMike.id,
        name: 'Home',
        street1: '100 Buyer Lane',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        country: 'US',
        isDefault: true,
      },
    }),
    prisma.address.create({
      data: {
        userId: buyerLisa.id,
        name: 'Home',
        street1: '200 Collector Street',
        street2: 'Apt 5B',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
        country: 'US',
        isDefault: true,
      },
    }),
  ])

  // ==================== PRODUCTS ====================
  console.log('📦 Creating products...')

  const products = await Promise.all([
    // US Coins
    prisma.product.create({
      data: {
        sku: 'USC-1921-MS65',
        title: '1921 Morgan Silver Dollar - PCGS MS65',
        description: 'Beautiful gem uncirculated 1921 Morgan Silver Dollar graded MS65 by PCGS. Last year of issue with exceptional luster and minimal contact marks. A stunning example of this classic American silver dollar.',
        shortDescription: 'PCGS MS65 graded 1921 Morgan Dollar',
        categoryId: usCoins.id,
        listingType: ListingType.BUY_NOW,
        price: 185.00,
        costBasis: 120.00,
        metalType: MetalType.SILVER,
        metalWeight: 0.7734,
        metalPurity: 0.9,
        year: 1921,
        mint: 'Philadelphia',
        grade: 'MS65',
        certification: 'PCGS',
        certNumber: '12345678',
        population: 15420,
        quantity: 1,
        status: ProductStatus.ACTIVE,
        condition: 'Mint State',
        clientId: heritageClient.id,
        isConsignment: true,
        consignmentRate: 12.5,
        featured: true,
        views: 234,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'USC-1893S-VF30',
        title: '1893-S Morgan Silver Dollar - Key Date - NGC VF30',
        description: 'The famous 1893-S Morgan Dollar, one of the key dates in the series with a mintage of only 100,000. This example grades VF30 by NGC with nice original surfaces and no problems. A must-have for any serious Morgan collection.',
        shortDescription: 'Key date 1893-S Morgan NGC VF30',
        categoryId: usCoins.id,
        listingType: ListingType.AUCTION,
        price: 4500.00,
        costBasis: 3200.00,
        metalType: MetalType.SILVER,
        metalWeight: 0.7734,
        metalPurity: 0.9,
        year: 1893,
        mint: 'San Francisco',
        grade: 'VF30',
        certification: 'NGC',
        certNumber: '87654321',
        population: 892,
        quantity: 1,
        status: ProductStatus.ACTIVE,
        condition: 'Very Fine',
        clientId: heritageClient.id,
        isConsignment: true,
        consignmentRate: 12.5,
        featured: true,
        views: 567,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'USC-1909SVDB-MS63',
        title: '1909-S VDB Lincoln Cent - PCGS MS63 RB',
        description: 'First year Lincoln cent with the famous VDB initials on reverse. San Francisco mint with low mintage of 484,000. Graded MS63 RB (Red-Brown) by PCGS. A cornerstone coin for any Lincoln cent collection.',
        shortDescription: '1909-S VDB Lincoln Cent MS63 RB',
        categoryId: usCoins.id,
        listingType: ListingType.BUY_NOW,
        price: 1850.00,
        costBasis: 1400.00,
        metalType: MetalType.COPPER,
        year: 1909,
        mint: 'San Francisco',
        grade: 'MS63 RB',
        certification: 'PCGS',
        certNumber: '11223344',
        quantity: 1,
        status: ProductStatus.ACTIVE,
        condition: 'Mint State',
        clientId: heritageClient.id,
        isConsignment: true,
        consignmentRate: 12.5,
        views: 189,
      },
    }),
    // Silver Bullion
    prisma.product.create({
      data: {
        sku: 'SLV-BAR-10OZ-001',
        title: '10 oz PAMP Suisse Silver Bar (.999 Fine)',
        description: 'Brand new 10 troy ounce silver bar from PAMP Suisse. Features the iconic Lady Fortuna design on the reverse. Each bar comes with assay certificate and serial number. .999 fine silver.',
        shortDescription: '10 oz PAMP Suisse Silver Bar',
        categoryId: silverBars.id,
        listingType: ListingType.BUY_NOW,
        price: 295.00,
        metalType: MetalType.SILVER,
        metalWeight: 10.0,
        metalPurity: 0.999,
        premiumPercent: 8.5,
        quantity: 15,
        status: ProductStatus.ACTIVE,
        condition: 'New',
        clientId: silverStackClient.id,
        isConsignment: true,
        consignmentRate: 15.0,
        views: 892,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'SLV-ROUND-1OZ-BUFF',
        title: '1 oz Silver Buffalo Round (.999 Fine)',
        description: 'Classic 1 troy ounce silver round featuring the iconic Buffalo/Indian Head design. .999 fine silver. Perfect for stacking or gift giving. Sold individually.',
        shortDescription: '1 oz Silver Buffalo Round',
        categoryId: rounds.id,
        listingType: ListingType.BUY_NOW,
        price: 32.50,
        metalType: MetalType.SILVER,
        metalWeight: 1.0,
        metalPurity: 0.999,
        premiumPercent: 12.0,
        quantity: 100,
        status: ProductStatus.ACTIVE,
        condition: 'New',
        clientId: silverStackClient.id,
        isConsignment: true,
        consignmentRate: 15.0,
        views: 1245,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'SLV-BAR-100OZ-RCM',
        title: '100 oz Royal Canadian Mint Silver Bar (.9999 Fine)',
        description: 'Premium 100 troy ounce silver bar from the Royal Canadian Mint. Features the RCM logo and maple leaf design. .9999 fine silver - among the purest available. Serial numbered with certificate.',
        shortDescription: '100 oz RCM Silver Bar',
        categoryId: silverBars.id,
        listingType: ListingType.BUY_NOW,
        price: 2850.00,
        metalType: MetalType.SILVER,
        metalWeight: 100.0,
        metalPurity: 0.9999,
        premiumPercent: 6.5,
        quantity: 3,
        status: ProductStatus.ACTIVE,
        condition: 'New',
        clientId: silverStackClient.id,
        isConsignment: true,
        consignmentRate: 15.0,
        featured: true,
        views: 456,
      },
    }),
    // Gold Bullion
    prisma.product.create({
      data: {
        sku: 'GLD-BAR-1OZ-PAMP',
        title: '1 oz PAMP Suisse Gold Bar (.9999 Fine)',
        description: 'Exquisite 1 troy ounce gold bar from PAMP Suisse featuring the Lady Fortuna design. Comes sealed in assay card with certificate. .9999 fine gold.',
        shortDescription: '1 oz PAMP Suisse Gold Bar',
        categoryId: goldBars.id,
        listingType: ListingType.BUY_NOW,
        price: 2150.00,
        metalType: MetalType.GOLD,
        metalWeight: 1.0,
        metalPurity: 0.9999,
        premiumPercent: 3.5,
        quantity: 5,
        status: ProductStatus.ACTIVE,
        condition: 'New',
        clientId: midwestGoldClient.id,
        isConsignment: true,
        consignmentRate: 10.0,
        featured: true,
        views: 678,
      },
    }),
    // Paper Money
    prisma.product.create({
      data: {
        sku: 'PM-1928-100-GOLD',
        title: '1928 $100 Gold Certificate - PMG VF25',
        description: 'Attractive 1928 $100 Gold Certificate featuring Benjamin Franklin. Graded Very Fine 25 by PMG with nice color and no major issues. Gold certificates are highly collectible due to their rarity.',
        shortDescription: '1928 $100 Gold Certificate VF25',
        categoryId: usCurrency.id,
        listingType: ListingType.AUCTION,
        price: 650.00,
        costBasis: 450.00,
        year: 1928,
        grade: 'VF25',
        certification: 'PMG',
        certNumber: '99887766',
        quantity: 1,
        status: ProductStatus.ACTIVE,
        condition: 'Very Fine',
        clientId: vintageCurrencyClient.id,
        isConsignment: true,
        consignmentRate: 18.0,
        views: 234,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'PM-1899-5-CHIEF',
        title: '1899 $5 Silver Certificate "Chief" Note - PCGS F15',
        description: 'The famous "Indian Chief" $5 Silver Certificate from 1899, one of the most beautiful US currency designs ever produced. Features Running Antelope on the face. Graded Fine 15 by PCGS Currency.',
        shortDescription: '1899 $5 Indian Chief Note F15',
        categoryId: usCurrency.id,
        listingType: ListingType.BUY_NOW,
        price: 1200.00,
        costBasis: 850.00,
        year: 1899,
        grade: 'F15',
        certification: 'PCGS',
        certNumber: '55443322',
        quantity: 1,
        status: ProductStatus.ACTIVE,
        condition: 'Fine',
        clientId: vintageCurrencyClient.id,
        isConsignment: true,
        consignmentRate: 18.0,
        featured: true,
        views: 345,
      },
    }),
    // World Coins
    prisma.product.create({
      data: {
        sku: 'WC-1889-SOV-MS62',
        title: '1889 British Gold Sovereign - NGC MS62',
        description: 'Beautiful Victorian era British Gold Sovereign from 1889 featuring Queen Victoria\'s Jubilee portrait. Graded MS62 by NGC. Contains 0.2354 troy ounces of .917 fine gold.',
        shortDescription: '1889 British Gold Sovereign MS62',
        categoryId: worldCoins.id,
        listingType: ListingType.BUY_NOW,
        price: 595.00,
        costBasis: 480.00,
        metalType: MetalType.GOLD,
        metalWeight: 0.2354,
        metalPurity: 0.917,
        premiumPercent: 18.0,
        year: 1889,
        mint: 'London',
        grade: 'MS62',
        certification: 'NGC',
        certNumber: '44556677',
        quantity: 1,
        status: ProductStatus.ACTIVE,
        condition: 'Mint State',
        clientId: heritageClient.id,
        isConsignment: true,
        consignmentRate: 12.5,
        views: 156,
      },
    }),
    // Draft product
    prisma.product.create({
      data: {
        sku: 'DRAFT-001',
        title: '2024 American Silver Eagle - BU',
        description: 'Brand new 2024 American Silver Eagle in Brilliant Uncirculated condition. Official US Mint bullion coin containing 1 troy ounce of .999 fine silver.',
        shortDescription: '2024 ASE Brilliant Uncirculated',
        categoryId: usCoins.id,
        listingType: ListingType.BUY_NOW,
        price: 38.00,
        metalType: MetalType.SILVER,
        metalWeight: 1.0,
        metalPurity: 0.999,
        year: 2024,
        mint: 'West Point',
        quantity: 50,
        status: ProductStatus.DRAFT,
        condition: 'BU',
        clientId: silverStackClient.id,
        isConsignment: true,
        consignmentRate: 15.0,
        views: 0,
      },
    }),
    // Sold product
    prisma.product.create({
      data: {
        sku: 'SOLD-1916D-MERC',
        title: '1916-D Mercury Dime - PCGS VG10 (SOLD)',
        description: 'Key date 1916-D Mercury Dime graded VG10 by PCGS. The most sought-after date in the Mercury Dime series.',
        shortDescription: '1916-D Mercury Dime VG10',
        categoryId: usCoins.id,
        listingType: ListingType.BUY_NOW,
        price: 1450.00,
        costBasis: 1100.00,
        metalType: MetalType.SILVER,
        metalWeight: 0.0723,
        metalPurity: 0.9,
        year: 1916,
        mint: 'Denver',
        grade: 'VG10',
        certification: 'PCGS',
        certNumber: '99001122',
        quantity: 0,
        status: ProductStatus.SOLD,
        condition: 'Very Good',
        clientId: heritageClient.id,
        isConsignment: true,
        consignmentRate: 12.5,
        views: 892,
      },
    }),
  ])

  // ==================== PRODUCT IMAGES ====================
  console.log('🖼️ Creating product images...')

  for (const product of products) {
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: `https://placeholder.coinshop.com/products/${product.sku.toLowerCase()}-obverse.jpg`,
        alt: `${product.title} - Obverse`,
        order: 0,
        isPrimary: true,
      },
    })
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: `https://placeholder.coinshop.com/products/${product.sku.toLowerCase()}-reverse.jpg`,
        alt: `${product.title} - Reverse`,
        order: 1,
        isPrimary: false,
      },
    })
  }

  // ==================== METAL PRICES ====================
  console.log('💰 Creating metal prices...')

  await Promise.all([
    prisma.metalPrice.create({
      data: {
        metalType: MetalType.GOLD,
        spotPrice: 2045.50,
        askPrice: 2048.00,
        bidPrice: 2043.00,
        change: 12.50,
        changePct: 0.0061,
        source: 'api',
      },
    }),
    prisma.metalPrice.create({
      data: {
        metalType: MetalType.SILVER,
        spotPrice: 24.15,
        askPrice: 24.25,
        bidPrice: 24.05,
        change: 0.35,
        changePct: 0.0147,
        source: 'api',
      },
    }),
    prisma.metalPrice.create({
      data: {
        metalType: MetalType.PLATINUM,
        spotPrice: 915.00,
        askPrice: 920.00,
        bidPrice: 910.00,
        change: -5.00,
        changePct: -0.0054,
        source: 'api',
      },
    }),
    prisma.metalPrice.create({
      data: {
        metalType: MetalType.PALLADIUM,
        spotPrice: 1025.00,
        askPrice: 1035.00,
        bidPrice: 1015.00,
        change: 8.00,
        changePct: 0.0079,
        source: 'api',
      },
    }),
  ])

  // ==================== SETTINGS ====================
  console.log('⚙️ Creating settings...')

  await Promise.all([
    prisma.setting.create({
      data: {
        key: 'site_name',
        value: JSON.stringify('Capital Pawn Coin Shop'),
      },
    }),
    prisma.setting.create({
      data: {
        key: 'default_commission_rate',
        value: JSON.stringify(15.0),
      },
    }),
    prisma.setting.create({
      data: {
        key: 'metal_price_update_interval',
        value: JSON.stringify(5), // minutes
      },
    }),
    prisma.setting.create({
      data: {
        key: 'scrape_default_frequency',
        value: JSON.stringify(60), // minutes
      },
    }),
  ])

  console.log('✅ Database seed completed successfully!')
  console.log(`
  Summary:
  - ${categories.length + childCategories.length} categories created
  - ${clients.length} clients created
  - ${users.length} users created
  - ${products.length} products created
  - Metal prices initialized
  - Settings configured

  Test Accounts:
  - Admin: admin@coinshop.com / password123
  - Staff: staff@coinshop.com / password123
  - Client: john@heritagecoingallery.com / password123
  - Buyer: mike.buyer@email.com / password123
  `)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
