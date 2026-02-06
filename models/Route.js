module.exports = (sequelize, DataTypes) => {
  const Route = sequelize.define(
    'Route',
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
      description: {
        type: DataTypes.TEXT,
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
      },
      territory_length: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
        validate: {
          min: 0,
          max: 150,
        },
      },
      sales_ref_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // Temporarily nullable for migration
        references: {
          model: 'employees',
          key: 'id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
    },
    {
      tableName: 'routes',
      timestamps: true,
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      indexes: [
        // code index removed - already created by unique: true constraint
        { fields: ['status'] },
        { fields: ['sales_ref_id'] },
      ],
    }
  );

  return Route;
};
