const bcrypt = require('bcryptjs');
const db = require('../models');

const seedDatabase = async () => {
  try {
    // Check if data already exists
    const userCount = await db.User.count();
    if (userCount > 0) {
      console.log('⚠️  Database already has data, skipping seed');
      return;
    }

    console.log('Seeding Users...');
    const users = await db.User.bulkCreate([
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

    console.log('Seeding Routes...');
    const routes = await db.Route.bulkCreate([
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

    console.log('Seeding Suppliers...');
    const suppliers = await db.Supplier.bulkCreate([
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

    console.log('Seeding Raw Materials...');
    const materials = await db.RawMaterial.bulkCreate([
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
    ]);
    console.log(`✅ Created ${materials.length} raw materials`);

    console.log('Seeding Products...');
    const products = await db.Product.bulkCreate([
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
    ]);
    console.log(`✅ Created ${products.length} products`);

    console.log('Seeding Product SKUs...');
    const skus = await db.ProductSku.bulkCreate([
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
    ]);
    console.log(`✅ Created ${skus.length} product SKUs`);

    console.log('Seeding Outlets...');
    const outlets = await db.Outlet.bulkCreate([
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

    console.log('Seeding Employees...');
    const employees = await db.Employee.bulkCreate([
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

    console.log('Seeding Vehicles...');
    const vehicles = await db.Vehicle.bulkCreate([
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

    console.log('Seeding Recipes...');
    const recipes = await db.Recipe.bulkCreate([
      {
        code: 'RCP001',
        name: 'Premium Curry Mix Recipe',
        version: 1,
        expected_yield: 100,
        yield_unit: 'kg',
        is_active: true,
        notes: 'Traditional blend',
      },
    ]);
    console.log(`✅ Created ${recipes.length} recipes`);

    console.log('Seeding Recipe Items...');
    const recipeItems = await db.RecipeItem.bulkCreate([
      {
        recipe_id: recipes[0].id,
        material_id: materials[0].id,
        quantity: 40,
        unit: 'kg',
      },
      {
        recipe_id: recipes[0].id,
        material_id: materials[1].id,
        quantity: 30,
        unit: 'kg',
      },
      {
        recipe_id: recipes[0].id,
        material_id: materials[2].id,
        quantity: 20,
        unit: 'kg',
      },
    ]);
    console.log(`✅ Created ${recipeItems.length} recipe items`);

    console.log('\n✅ Database seeding completed!');
  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
    throw error;
  }
};

module.exports = seedDatabase;
