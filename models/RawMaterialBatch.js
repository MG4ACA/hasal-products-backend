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
      batch_type: {
        type: DataTypes.ENUM('receipt', 'return'),
        allowNull: false,
        defaultValue: 'receipt',
      },
      return_reason: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      return_disposition: {
        type: DataTypes.ENUM('stock', 'dispose'),
        allowNull: true,
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
      inspection_status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
        allowNull: false,
      },
      inspection_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      inspection_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      accepted_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: false,
      },
      rejected_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: false,
      },
      source_batch_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'raw_material_batches',
          key: 'id',
        },
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'raw_material_batches',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
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
