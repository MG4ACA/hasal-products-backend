module.exports = (sequelize, DataTypes) => {
  const Employee = sequelize.define(
    'Employee',
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
      type: {
        type: DataTypes.ENUM('sales_ref', 'driver', 'warehouse', 'other'),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(20),
      },
      email: {
        type: DataTypes.STRING(100),
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
      },
    },
    {
      tableName: 'employees',
      timestamps: true,
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      indexes: [
        // code index removed - already created by unique: true constraint
        { fields: ['type'] },
        { fields: ['status'] },
      ],
    }
  );

  return Employee;
};
