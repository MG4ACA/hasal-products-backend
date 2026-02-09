module.exports = (sequelize, DataTypes) => {
  const Expense = sequelize.define(
    'Expense',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      expense_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      category: {
        type: DataTypes.ENUM(
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
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      vehicle_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'vehicles',
          key: 'id',
        },
      },
      route_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'routes',
          key: 'id',
        },
      },
      distance_km: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
    },
    {
      tableName: 'expenses',
      timestamps: true,
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      indexes: [
        { fields: ['expense_date'] },
        { fields: ['category'] },
        { fields: ['vehicle_id'] },
        { fields: ['route_id'] },
      ],
    }
  );

  Expense.associate = models => {
    Expense.belongsTo(models.Vehicle, {
      foreignKey: 'vehicle_id',
      as: 'vehicle',
    });
    Expense.belongsTo(models.Route, {
      foreignKey: 'route_id',
      as: 'route',
    });
    Expense.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator',
    });
  };

  return Expense;
};
