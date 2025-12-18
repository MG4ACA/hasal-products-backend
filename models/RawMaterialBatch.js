module.exports = (sequelize, DataTypes) => {
  const RawMaterialBatch = sequelize.define(
    'RawMaterialBatch',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      material_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'raw_materials',
          key: 'id',
        },
      },
      supplier_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'suppliers',
          key: 'id',
        },
      },
      batch_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      unit_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      purchase_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      expiry_date: {
        type: DataTypes.DATEONLY,
      },
    },
    {
      tableName: 'raw_material_batches',
      timestamps: false,
      createdAt: 'created_at',
      indexes: [
        { fields: ['material_id'] },
        { fields: ['batch_number'] },
        { fields: ['supplier_id'] },
        { fields: ['purchase_date'] },
      ],
    }
  );

  return RawMaterialBatch;
};
