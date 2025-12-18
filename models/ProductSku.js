module.exports = (sequelize, DataTypes) => {
  const ProductSku = sequelize.define(
    'ProductSku',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id',
        },
      },
      size: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      unit: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      barcode: {
        type: DataTypes.STRING(50),
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      current_stock: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
      },
    },
    {
      tableName: 'product_skus',
      timestamps: true,
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      indexes: [
        { fields: ['barcode'] },
        { fields: ['product_id'] },
        { fields: ['status'] },
        { fields: ['product_id', 'size'], unique: true },
      ],
    }
  );

  return ProductSku;
};
