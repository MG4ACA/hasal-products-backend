module.exports = (sequelize, DataTypes) => {
  const Outlet = sequelize.define(
    'Outlet',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      code: {
        type: DataTypes.STRING(20),
        unique: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      owner_name: {
        type: DataTypes.STRING(100),
      },
      phone: {
        type: DataTypes.STRING(20),
      },
      email: {
        type: DataTypes.STRING(100),
      },
      address: {
        type: DataTypes.TEXT,
      },
      route_id: {
        type: DataTypes.INTEGER,
        references: {
          model: 'routes',
          key: 'id',
        },
      },
      default_discount: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 20.0,
      },
      credit_limit: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
      },
      balance: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
      },
      payment_terms: {
        type: DataTypes.ENUM('cash', 'credit', 'cheque', 'bank_transfer', 'card', 'mixed'),
        defaultValue: 'cash',
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
      },
    },
    {
      tableName: 'outlets',
      timestamps: true,
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      indexes: [
        // code index removed - already created by unique: true constraint
        { fields: ['name'] },
        { fields: ['route_id'] },
        { fields: ['status'] },
      ],
    }
  );

  return Outlet;
};
