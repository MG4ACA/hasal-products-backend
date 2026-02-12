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
          name: 'Akuressa Territory',
          description: 'Akuressa Territory route (514 outlets)',
          status: 'active',
        },
        {
          code: 'RT002',
          name: 'Galle 3 Territory',
          description: 'Galle 3 Territory route (348 outlets)',
          status: 'active',
        },
        {
          code: 'RT003',
          name: 'Baddegama Territory',
          description: 'Baddegama Territory route (277 outlets)',
          status: 'active',
        },
        {
          code: 'RT004',
          name: 'Galle 2 Territory',
          description: 'Galle 2 Territory route (178 outlets)',
          status: 'active',
        },
        {
          code: 'RT005',
          name: 'By Route',
          description: 'By Route territory (131 outlets)',
          status: 'active',
        },
        {
          code: 'RT006',
          name: 'Elpitiya Territory',
          description: 'Elpitiya Territory route (90 outlets)',
          status: 'active',
        },
        {
          code: 'RT007',
          name: 'Galle 1',
          description: 'Galle 1 Territory route (68 outlets)',
          status: 'active',
        },
        {
          code: 'RT008',
          name: 'Hikkaduwa',
          description: 'Hikkaduwa Territory route (1 outlet)',
          status: 'active',
        },
        {
          code: 'RT009',
          name: 'Hirimbura Galle 1',
          description: 'Hirimbura Galle 1 Territory route (1 outlet)',
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

    // Note: Products and SKUs are now seeded via seed-products.js

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

    // Seed Legacy Return Placeholder Invoice (skip if already exists)
    const legacyInvoice = await db.SalesInvoice.findOne({
      where: { invoice_number: 'LEGACY-SYSTEM-SETUP' },
    });

    if (legacyInvoice) {
      console.log('⚠️  Legacy return placeholder invoice already exists');
    } else {
      console.log('Creating Legacy return placeholder invoice...');

      // Get the first outlet to use as reference
      const outlet = await db.Outlet.findOne({ order: [['id', 'ASC']] });

      if (!outlet) {
        console.log(
          '⚠️  No outlets found. Legacy invoice will be created when outlets are seeded.'
        );
      } else {
        // Use the first user (admin) as creator
        const adminUser = await db.User.findOne({
          where: { role: 'admin' },
          order: [['id', 'ASC']],
        });

        await db.SalesInvoice.create({
          invoice_number: 'LEGACY-SYSTEM-SETUP',
          invoice_date: '2000-01-01', // Clearly historical date
          outlet_id: outlet.id,
          payment_method: 'cash',
          payment_status: 'paid',
          subtotal: 0,
          discount_amount: 0,
          total_amount: 0,
          created_by: adminUser.id,
          notes:
            'System placeholder for pre-implementation returns. Do not modify or delete. This is a reference invoice for tracking returns from purchases made before the POS system went live.',
        });
        console.log('✅ Created LEGACY-SYSTEM-SETUP placeholder invoice');
      }
    }

    // Note: Recipes and Recipe Items can be seeded separately when needed
    // They have been removed to avoid dependencies on sample products

    console.log('\n✅ Database seeding completed!');
  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
    throw error;
  }
};

module.exports = seedDatabase;
