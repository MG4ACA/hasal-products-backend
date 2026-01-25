const bcrypt = require('bcryptjs');
const db = require('../models');

const seedDatabase = async () => {
  try {
    // Seed Users (skip if already exist)
    const userCount = await db.User.count();
    let users;
    if (userCount > 0) {
      console.log('⚠️  Users already exist, fetching existing users');
      users = await db.User.findAll({ limit: 2 });
    } else {
      console.log('Seeding Users...');
      users = await db.User.bulkCreate([
        {
          username: 'admin',
          password_hash: bcrypt.hashSync('admin123', 10),
          role: 'admin',
          full_name: 'Admin User',
          email: 'admin@hasal.com',
          phone: '0771234567',
          status: 'active',
        },
        {
          username: 'cashier1',
          password_hash: bcrypt.hashSync('cashier123', 10),
          role: 'cashier',
          full_name: 'Cashier One',
          email: 'cashier1@hasal.com',
          phone: '0771234568',
          status: 'active',
        },
      ]);
      console.log(`✅ Created ${users.length} users`);
    }

    // Seed Routes (skip if already exist)
    const routeCount = await db.Route.count();
    let routes;
    if (routeCount > 0) {
      console.log('⚠️  Routes already exist, fetching existing routes');
      routes = await db.Route.findAll();
    } else {
      console.log('Seeding Routes...');
      routes = await db.Route.bulkCreate([
        {
          code: 'RT001',
          name: 'Colombo North Route',
          description: 'Route covering North Colombo area',
          status: 'active',
        },
        {
          code: 'RT002',
          name: 'Colombo South Route',
          description: 'Route covering South Colombo area',
          status: 'active',
        },
        {
          code: 'RT003',
          name: 'Suburbs Route',
          description: 'Route covering suburban areas',
          status: 'active',
        },
      ]);
      console.log(`✅ Created ${routes.length} routes`);
    }

    // Seed Suppliers (skip if already exist)
    const supplierCount = await db.Supplier.count();
    let suppliers;
    if (supplierCount > 0) {
      console.log('⚠️  Suppliers already exist, fetching existing suppliers');
      suppliers = await db.Supplier.findAll();
    } else {
      console.log('Seeding Suppliers...');
      suppliers = await db.Supplier.bulkCreate([
        {
          code: 'SUP001',
          name: 'Fresh Spices Ltd',
          contact_person: 'John Silva',
          phone: '0771111111',
          email: 'contact@freshspices.com',
          address: '123 Spice Lane, Colombo',
          payment_terms: 'credit',
          balance: 0,
          status: 'active',
        },
        {
          code: 'SUP002',
          name: 'Organic Ingredients Co',
          contact_person: 'Maria Perera',
          phone: '0772222222',
          email: 'sales@organicing.lk',
          address: '456 Organic Road, Kandy',
          payment_terms: 'credit',
          balance: 0,
          status: 'active',
        },
        {
          code: 'SUP003',
          name: 'Premium Herbs Trading',
          contact_person: 'Ahmed Khan',
          phone: '0773333333',
          email: 'trading@premiumherbs.com',
          address: '789 Herb Street, Galle',
          payment_terms: 'cash',
          balance: 0,
          status: 'active',
        },
        {
          code: 'SUP004',
          name: 'Global Spice Imports',
          contact_person: 'David Kumar',
          phone: '0774444444',
          email: 'info@globalspice.com',
          address: '321 Import Lane, Negombo',
          payment_terms: 'credit',
          balance: 0,
          status: 'active',
        },
        {
          code: 'SUP005',
          name: 'Local Farmers Association',
          contact_person: 'Ramesh Wijaya',
          phone: '0775555555',
          email: 'farmers@localassoc.lk',
          address: '654 Farm Road, Matara',
          payment_terms: 'cash',
          balance: 0,
          status: 'active',
        },
        {
          code: 'SUP006',
          name: 'Export Quality Spices',
          contact_person: 'Lisa Fernando',
          phone: '0776666666',
          email: 'quality@exportspice.lk',
          address: '987 Quality Street, Jaffna',
          payment_terms: 'credit',
          balance: 0,
          status: 'active',
        },
        {
          code: 'SUP007',
          name: 'Heritage Spice Mills',
          contact_person: 'Sunil Mendis',
          phone: '0777777777',
          email: 'heritage@spicemills.lk',
          address: '234 Mill Street, Anuradhapura',
          payment_terms: 'check',
          balance: 0,
          status: 'active',
        },
        {
          code: 'SUP008',
          name: 'Tropical Flavors Ltd',
          contact_person: 'Nina Jayasundara',
          phone: '0778888888',
          email: 'sales@tropicalflavors.lk',
          address: '567 Tropical Avenue, Colombo',
          payment_terms: 'credit',
          balance: 0,
          status: 'active',
        },
        {
          code: 'SUP009',
          name: 'Quality Blend Suppliers',
          contact_person: 'Rohan Gunawardena',
          phone: '0779999999',
          email: 'blend@qualitysupp.lk',
          address: '890 Blend Road, Ratnapura',
          payment_terms: 'cash',
          balance: 0,
          status: 'active',
        },
        {
          code: 'SUP010',
          name: 'Spice House International',
          contact_person: 'Sandra Wijesinghe',
          phone: '0770000000',
          email: 'intl@spicehouse.com',
          address: '111 International Way, Colombo',
          payment_terms: 'credit',
          balance: 0,
          status: 'active',
        },
        {
          code: 'SUP011',
          name: 'Pure Essence Trading',
          contact_person: 'Vikram Sharma',
          phone: '0711111111',
          email: 'essence@puretrading.lk',
          address: '222 Essence Lane, Kurunegala',
          payment_terms: 'check',
          balance: 0,
          status: 'active',
        },
      ]);
      console.log(`✅ Created ${suppliers.length} suppliers`);
    }

    // Seed Raw Materials (skip if already exist)
    const materialCount = await db.RawMaterial.count();
    let materials;
    if (materialCount > 0) {
      console.log('⚠️  Raw Materials already exist, fetching existing materials');
      materials = await db.RawMaterial.findAll();
    } else {
      console.log('Seeding Raw Materials...');
      materials = await db.RawMaterial.bulkCreate([
        {
          code: 'RM001',
          name: 'Turmeric Powder',
          category: 'Spices',
          unit: 'kg',
          reorder_level: 50,
          status: 'active',
        },
        {
          code: 'RM002',
          name: 'Chili Powder',
          category: 'Spices',
          unit: 'kg',
          reorder_level: 30,
          status: 'active',
        },
        {
          code: 'RM003',
          name: 'Black Pepper',
          category: 'Spices',
          unit: 'kg',
          reorder_level: 25,
          status: 'active',
        },
        {
          code: 'RM004',
          name: 'Cinnamon',
          category: 'Spices',
          unit: 'kg',
          reorder_level: 20,
          status: 'active',
        },
        {
          code: 'RM005',
          name: 'Cardamom',
          category: 'Spices',
          unit: 'kg',
          reorder_level: 15,
          status: 'active',
        },
        {
          code: 'RM006',
          name: 'Coriander Seeds',
          category: 'Spices',
          unit: 'kg',
          reorder_level: 40,
          status: 'active',
        },
        {
          code: 'RM007',
          name: 'Cumin Seeds',
          category: 'Spices',
          unit: 'kg',
          reorder_level: 35,
          status: 'active',
        },
        {
          code: 'RM008',
          name: 'Fenugreek',
          category: 'Spices',
          unit: 'kg',
          reorder_level: 20,
          status: 'active',
        },
      ]);
      console.log(`✅ Created ${materials.length} raw materials`);
    }

    // Seed Raw Material Batches (skip if already exist)
    // const batchCount = await db.RawMaterialBatch.count();
    // let batches;
    // if (batchCount > 0) {
    //   console.log('⚠️  Raw Material Batches already exist, skipping');
    //   batches = await db.RawMaterialBatch.findAll();
    // } else {
    //   console.log('Seeding Raw Material Batches...');
    //   // Create multiple batches for FIFO testing
    //   batches = await db.RawMaterialBatch.bulkCreate([
    //     // Turmeric - Multiple batches for FIFO testing
    //     {
    //       material_id: materials[0].id, // Turmeric
    //       batch_number: 'TUR-B001',
    //       supplier_id: suppliers[0].id,
    //       batch_type: 'receipt',
    //       quantity: 100,
    //       unit_cost: 1000, // Older batch @ 1000/kg
    //       purchase_date: '2024-01-01',
    //       expiry_date: '2025-01-01',
    //       inspection_status: 'approved',
    //       accepted_quantity: 100,
    //     },
    //     {
    //       material_id: materials[0].id, // Turmeric
    //       batch_number: 'TUR-B002',
    //       supplier_id: suppliers[0].id,
    //       batch_type: 'receipt',
    //       quantity: 150,
    //       unit_cost: 1200, // Newer batch @ 1200/kg
    //       purchase_date: '2024-01-15',
    //       expiry_date: '2025-01-15',
    //       inspection_status: 'approved',
    //       accepted_quantity: 150,
    //     },
    //     // Chili Powder - Multiple batches
    //     {
    //       material_id: materials[1].id, // Chili Powder
    //       batch_number: 'CHI-B001',
    //       supplier_id: suppliers[1].id,
    //       batch_type: 'receipt',
    //       quantity: 80,
    //       unit_cost: 800,
    //       purchase_date: '2024-01-02',
    //       expiry_date: '2025-01-02',
    //       inspection_status: 'approved',
    //       accepted_quantity: 80,
    //     },
    //     {
    //       material_id: materials[1].id, // Chili Powder
    //       batch_number: 'CHI-B002',
    //       supplier_id: suppliers[1].id,
    //       batch_type: 'receipt',
    //       quantity: 120,
    //       unit_cost: 850,
    //       purchase_date: '2024-01-20',
    //       expiry_date: '2025-01-20',
    //       inspection_status: 'approved',
    //       accepted_quantity: 120,
    //     },
    //     // Coriander Seeds - Multiple batches
    //     {
    //       material_id: materials[5].id, // Coriander Seeds
    //       batch_number: 'COR-B001',
    //       supplier_id: suppliers[2].id,
    //       batch_type: 'receipt',
    //       quantity: 200,
    //       unit_cost: 500,
    //       purchase_date: '2024-01-05',
    //       expiry_date: '2025-01-05',
    //       inspection_status: 'approved',
    //       accepted_quantity: 200,
    //     },
    //     {
    //       material_id: materials[5].id, // Coriander Seeds
    //       batch_number: 'COR-B002',
    //       supplier_id: suppliers[2].id,
    //       batch_type: 'receipt',
    //       quantity: 150,
    //       unit_cost: 550,
    //       purchase_date: '2024-01-25',
    //       expiry_date: '2025-01-25',
    //       inspection_status: 'approved',
    //       accepted_quantity: 150,
    //     },
    //     // Cumin Seeds - Multiple batches
    //     {
    //       material_id: materials[6].id, // Cumin Seeds
    //       batch_number: 'CUM-B001',
    //       supplier_id: suppliers[3].id,
    //       batch_type: 'receipt',
    //       quantity: 100,
    //       unit_cost: 600,
    //       purchase_date: '2024-01-03',
    //       expiry_date: '2025-01-03',
    //       inspection_status: 'approved',
    //       accepted_quantity: 100,
    //     },
    //     {
    //       material_id: materials[6].id, // Cumin Seeds
    //       batch_number: 'CUM-B002',
    //       supplier_id: suppliers[3].id,
    //       batch_type: 'receipt',
    //       quantity: 120,
    //       unit_cost: 650,
    //       purchase_date: '2024-01-18',
    //       expiry_date: '2025-01-18',
    //       inspection_status: 'approved',
    //       accepted_quantity: 120,
    //     },
    //     // Single batches for other materials
    //     {
    //       material_id: materials[2].id, // Black Pepper
    //       batch_number: 'BPP-B001',
    //       supplier_id: suppliers[0].id,
    //       batch_type: 'receipt',
    //       quantity: 50,
    //       unit_cost: 1500,
    //       purchase_date: '2024-01-10',
    //       expiry_date: '2025-01-10',
    //       inspection_status: 'approved',
    //       accepted_quantity: 50,
    //     },
    //     {
    //       material_id: materials[3].id, // Cinnamon
    //       batch_number: 'CIN-B001',
    //       supplier_id: suppliers[1].id,
    //       batch_type: 'receipt',
    //       quantity: 40,
    //       unit_cost: 2000,
    //       purchase_date: '2024-01-12',
    //       expiry_date: '2025-01-12',
    //       inspection_status: 'approved',
    //       accepted_quantity: 40,
    //     },
    //     {
    //       material_id: materials[4].id, // Cardamom
    //       batch_number: 'CAR-B001',
    //       supplier_id: suppliers[2].id,
    //       batch_type: 'receipt',
    //       quantity: 30,
    //       unit_cost: 3000,
    //       purchase_date: '2024-01-08',
    //       expiry_date: '2025-01-08',
    //       inspection_status: 'approved',
    //       accepted_quantity: 30,
    //     },
    //     {
    //       material_id: materials[7].id, // Fenugreek
    //       batch_number: 'FEN-B001',
    //       supplier_id: suppliers[3].id,
    //       batch_type: 'receipt',
    //       quantity: 60,
    //       unit_cost: 400,
    //       purchase_date: '2024-01-14',
    //       expiry_date: '2025-01-14',
    //       inspection_status: 'approved',
    //       accepted_quantity: 60,
    //     },
    //   ]);
    //   console.log(`✅ Created ${batches.length} raw material batches`);
    // }

    // Seed Products (skip if already exist)
    const productCount = await db.Product.count();
    let products;
    if (productCount > 0) {
      console.log('⚠️  Products already exist, fetching existing products');
      products = await db.Product.findAll();
    } else {
      console.log('Seeding Products...');
      products = await db.Product.bulkCreate([
        {
          code: 'PROD001',
          name: 'Premium Curry Mix',
          category: 'Mixed Spices',
          barcode: 'PROD001BAR',
          description: 'Authentic blend of traditional spices',
          status: 'active',
        },
        {
          code: 'PROD002',
          name: 'Turmeric Gold',
          category: 'Single Spice',
          barcode: 'PROD002BAR',
          description: 'Pure turmeric powder',
          status: 'active',
        },
        {
          code: 'PROD003',
          name: 'Hot Chili Blend',
          category: 'Mixed Spices',
          barcode: 'PROD003BAR',
          description: 'Fiery blend of chili spices',
          status: 'active',
        },
        {
          code: 'PROD004',
          name: 'Roasted Curry Powder',
          category: 'Mixed Spices',
          barcode: 'PROD004BAR',
          description: 'Premium roasted curry powder',
          status: 'active',
        },
      ]);
      console.log(`✅ Created ${products.length} products`);
    }

    // Seed Product SKUs (skip if already exist)
    const skuCount = await db.ProductSku.count();
    let skus;
    if (skuCount > 0) {
      console.log('⚠️  Product SKUs already exist, fetching existing SKUs');
      skus = await db.ProductSku.findAll();
    } else {
      console.log('Seeding Product SKUs...');
      skus = await db.ProductSku.bulkCreate([
        {
          product_id: products[0].id,
          size: '100g',
          unit: 'g',
          barcode: 'SKU001',
          price: 450,
          current_stock: 100,
          status: 'active',
        },
        {
          product_id: products[0].id,
          size: '500g',
          unit: 'g',
          barcode: 'SKU002',
          price: 2000,
          current_stock: 50,
          status: 'active',
        },
        {
          product_id: products[1].id,
          size: '100g',
          unit: 'g',
          barcode: 'SKU003',
          price: 350,
          current_stock: 150,
          status: 'active',
        },
        {
          product_id: products[2].id,
          size: '100g',
          unit: 'g',
          barcode: 'SKU004',
          price: 500,
          current_stock: 75,
          status: 'active',
        },
        {
          product_id: products[3].id, // Roasted Curry Powder
          size: '100g',
          unit: 'g',
          barcode: 'SKU005',
          price: 550,
          current_stock: 0, // Will be produced
          status: 'active',
        },
        {
          product_id: products[3].id, // Roasted Curry Powder
          size: '500g',
          unit: 'g',
          barcode: 'SKU006',
          price: 2500,
          current_stock: 0, // Will be produced
          status: 'active',
        },
      ]);
      console.log(`✅ Created ${skus.length} product SKUs`);
    }

    // Seed Outlets (skip if already exist)
    const outletCount = await db.Outlet.count();
    let outlets;
    if (outletCount > 0) {
      console.log('⚠️  Outlets already exist, fetching existing outlets');
      outlets = await db.Outlet.findAll();
    } else {
      console.log('Seeding Outlets...');
      outlets = await db.Outlet.bulkCreate([
        {
          code: 'OUT001',
          name: 'Colombo Mini Mart',
          owner_name: 'Ravi Kumar',
          phone: '0787654321',
          email: 'colombo@minimart.lk',
          address: '100 High Street, Colombo 7',
          route_id: routes[0].id,
          default_discount: 15,
          credit_limit: 50000,
          balance: 0,
          payment_terms: 'credit',
          status: 'active',
        },
        {
          code: 'OUT002',
          name: 'Kandy Central Store',
          owner_name: 'Sunitha Patel',
          phone: '0717654321',
          email: 'kandy@centralstore.lk',
          address: '200 Temple Road, Kandy',
          route_id: routes[1].id,
          default_discount: 10,
          credit_limit: 30000,
          balance: 0,
          payment_terms: 'credit',
          status: 'active',
        },
        {
          code: 'OUT003',
          name: 'Galle Shop',
          owner_name: 'Ahmed Hassan',
          phone: '0727654321',
          email: 'galle@shop.lk',
          address: '300 Beach Road, Galle',
          route_id: routes[2].id,
          default_discount: 20,
          credit_limit: 20000,
          balance: 0,
          payment_terms: 'cash',
          status: 'active',
        },
      ]);
      console.log(`✅ Created ${outlets.length} outlets`);
    }

    // Seed Employees (skip if already exist)
    const employeeCount = await db.Employee.count();
    let employees;
    if (employeeCount > 0) {
      console.log('⚠️  Employees already exist, fetching existing employees');
      employees = await db.Employee.findAll();
    } else {
      console.log('Seeding Employees...');
      employees = await db.Employee.bulkCreate([
        {
          code: 'EMP001',
          name: 'Priya Silva',
          type: 'sales_ref',
          phone: '0761111111',
          email: 'priya@hasal.com',
          assigned_route_id: routes[0].id,
          status: 'active',
        },
        {
          code: 'EMP002',
          name: 'Kiran Perera',
          type: 'driver',
          phone: '0762222222',
          email: 'kiran@hasal.com',
          assigned_route_id: routes[1].id,
          status: 'active',
        },
        {
          code: 'EMP003',
          name: 'Lakshan Fernando',
          type: 'warehouse',
          phone: '0763333333',
          email: 'lakshan@hasal.com',
          status: 'active',
        },
      ]);
      console.log(`✅ Created ${employees.length} employees`);
    }

    // Seed Vehicles (skip if already exist)
    const vehicleCount = await db.Vehicle.count();
    let vehicles;
    if (vehicleCount > 0) {
      console.log('⚠️  Vehicles already exist, fetching existing vehicles');
      vehicles = await db.Vehicle.findAll();
    } else {
      console.log('Seeding Vehicles...');
      vehicles = await db.Vehicle.bulkCreate([
        {
          code: 'VH001',
          name: 'Van A',
          registration_number: 'CAR001',
          status: 'active',
        },
        {
          code: 'VH002',
          name: 'Van B',
          registration_number: 'CAR002',
          status: 'active',
        },
      ]);
      console.log(`✅ Created ${vehicles.length} vehicles`);
    }

    // Seed Recipes (skip if already exist)
    const recipeCount = await db.Recipe.count();
    let recipes;
    if (recipeCount > 0) {
      console.log('⚠️  Recipes already exist, fetching existing recipes');
      recipes = await db.Recipe.findAll();
    } else {
      console.log('Seeding Recipes...');
      recipes = await db.Recipe.bulkCreate([
        {
          code: 'RCP001',
          name: 'Premium Curry Mix Recipe',
          version: 1,
          expected_yield: 100,
          yield_unit: 'kg',
          is_active: true,
          notes: 'Traditional blend',
        },
        {
          code: 'RCP002',
          name: 'Roasted Curry Powder Recipe',
          version: 2,
          product_sku_id: null, // Will be updated after SKU linking
          expected_yield: 100,
          yield_unit: 'kg',
          is_active: true,
          notes: 'Premium roasted curry powder blend - for Week 5 testing',
        },
      ]);
      console.log(`✅ Created ${recipes.length} recipes`);

      // Link recipe to Roasted Curry Powder SKU (100g size) - only for new recipes
      if (recipes.length > 1 && recipes[1].code === 'RCP002') {
        await recipes[1].update({ product_sku_id: skus[4].id });
      }
    }

    // Seed Recipe Items (skip if already exist)
    const recipeItemCount = await db.RecipeItem.count();
    if (recipeItemCount > 0) {
      console.log('⚠️  Recipe Items already exist, skipping');
    } else {
      console.log('Seeding Recipe Items...');
      const recipeItems = await db.RecipeItem.bulkCreate([
        // Premium Curry Mix Recipe items
        {
          recipe_id: recipes[0].id,
          material_id: materials[0].id, // Turmeric
          quantity: 40,
          unit: 'kg',
        },
        {
          recipe_id: recipes[0].id,
          material_id: materials[1].id, // Chili Powder
          quantity: 30,
          unit: 'kg',
        },
        {
          recipe_id: recipes[0].id,
          material_id: materials[2].id, // Black Pepper
          quantity: 20,
          unit: 'kg',
        },
        // Roasted Curry Powder Recipe items (for 100kg yield)
        {
          recipe_id: recipes[1].id,
          material_id: materials[0].id, // Turmeric - 5kg
          quantity: 5,
          unit: 'kg',
        },
        {
          recipe_id: recipes[1].id,
          material_id: materials[1].id, // Chili Powder - 3kg
          quantity: 3,
          unit: 'kg',
        },
        {
          recipe_id: recipes[1].id,
          material_id: materials[5].id, // Coriander Seeds - 60kg
          quantity: 60,
          unit: 'kg',
        },
        {
          recipe_id: recipes[1].id,
          material_id: materials[6].id, // Cumin Seeds - 20kg
          quantity: 20,
          unit: 'kg',
        },
        {
          recipe_id: recipes[1].id,
          material_id: materials[2].id, // Black Pepper - 5kg
          quantity: 5,
          unit: 'kg',
        },
        {
          recipe_id: recipes[1].id,
          material_id: materials[7].id, // Fenugreek - 4kg
          quantity: 4,
          unit: 'kg',
        },
        {
          recipe_id: recipes[1].id,
          material_id: materials[3].id, // Cinnamon - 2kg
          quantity: 2,
          unit: 'kg',
        },
        {
          recipe_id: recipes[1].id,
          material_id: materials[4].id, // Cardamom - 1kg
          quantity: 1,
          unit: 'kg',
        },
      ]);
      console.log(`✅ Created ${recipeItems.length} recipe items`);
    }

    console.log('\n✅ Database seeding completed!');
  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
    throw error;
  }
};

module.exports = seedDatabase;
