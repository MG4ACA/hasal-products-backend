'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('wastage_records', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      wastage_type: {
        type: Sequelize.ENUM(
          'expiry',
          'damage',
          'production',
          'quality_reject',
          'spillage',
          'theft',
          'other'
        ),
        allowNull: false,
        comment: 'Type of wastage',
      },
      item_type: {
        type: Sequelize.ENUM('raw_material', 'finished_goods'),
        allowNull: false,
        comment: 'Whether raw material or finished product',
      },
      item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Reference to raw_materials.id or product_skus.id',
      },
      item_name: {
        type: Sequelize.STRING(150),
        allowNull: true,
        comment: 'Item name for quick reference',
      },
      quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Quantity wasted',
      },
      unit: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Unit of measurement',
      },
      unit_cost: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Cost per unit at time of wastage',
      },
      total_cost: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Total wastage cost = quantity × unit_cost',
      },
      reason: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Brief reason for wastage',
      },
      detailed_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Detailed notes about the wastage',
      },
      wastage_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Date when wastage occurred or was identified',
      },
      location: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Where the wastage occurred (warehouse, production, etc.)',
      },
      recorded_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        comment: 'User who recorded the wastage',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes for better performance
    await queryInterface.addIndex('wastage_records', ['wastage_type'], {
      name: 'idx_wastage_type',
    });

    await queryInterface.addIndex('wastage_records', ['item_type', 'item_id'], {
      name: 'idx_wastage_item',
    });

    await queryInterface.addIndex('wastage_records', ['wastage_date'], {
      name: 'idx_wastage_date',
    });

    await queryInterface.addIndex('wastage_records', ['recorded_by'], {
      name: 'idx_wastage_recorded_by',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('wastage_records');
  },
};
