module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define(
    'Product',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      code: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(50),
      },
      barcode: {
        type: DataTypes.STRING(50),
      },
      description: {
        type: DataTypes.TEXT,
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
      },
    },
    {
      tableName: 'products',
      timestamps: true,
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      indexes: [
        { fields: ['code'], unique: true },
        { fields: ['barcode'], unique: true },
      ],
    }
  );

  return Product;
};
