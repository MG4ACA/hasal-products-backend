'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('expenses', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      expense_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Date when expense occurred',
      },
      category: {
        type: Sequelize.ENUM(
          'vehicle_fuel',
          'vehicle_repair',
          'utility_bills',
          'store_maintenance',
          'equipment_repair',
          'salaries',
          'rent',
          'other'
        ),
        allowNull: false,
        comment: 'Expense category',
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Expense amount',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Expense description/notes',
      },
      // Vehicle-specific fields (nullable for non-vehicle expenses)
      vehicle_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'vehicles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Vehicle reference for vehicle-related expenses',
      },
      route_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'routes',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Route reference for vehicle fuel expenses',
      },
      distance_km: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Distance traveled (for fuel expenses)',
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes
    await queryInterface.addIndex('expenses', ['expense_date'], {
      name: 'idx_expense_date',
    });
    await queryInterface.addIndex('expenses', ['category'], {
      name: 'idx_category',
    });
    await queryInterface.addIndex('expenses', ['vehicle_id'], {
      name: 'idx_vehicle',
    });
    await queryInterface.addIndex('expenses', ['route_id'], {
      name: 'idx_route',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('expenses');
  },
};
