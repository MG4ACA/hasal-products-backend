module.exports = (sequelize, DataTypes) => {
  const WastageRecord = sequelize.define(
    'WastageRecord',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      wastage_type: {
        type: DataTypes.ENUM(
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
        type: DataTypes.ENUM('raw_material', 'finished_goods'),
        allowNull: false,
        comment: 'Whether raw material or finished product',
      },
      item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Reference to raw_materials.id or product_skus.id',
      },
      item_name: {
        type: DataTypes.STRING(150),
        allowNull: true,
        comment: 'Item name for quick reference',
      },
      quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Quantity wasted',
      },
      unit: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'Unit of measurement',
      },
      unit_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Cost per unit at time of wastage',
      },
      total_cost: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Total wastage cost = quantity × unit_cost',
      },
      reason: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Brief reason for wastage',
      },
      detailed_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Detailed notes about the wastage',
      },
      wastage_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Date when wastage occurred or was identified',
      },
      location: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Where the wastage occurred',
      },
      recorded_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        comment: 'User who recorded the wastage',
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
      tableName: 'wastage_records',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['wastage_type'] },
        { fields: ['item_type', 'item_id'] },
        { fields: ['wastage_date'] },
        { fields: ['recorded_by'] },
      ],
    }
  );

  return WastageRecord;
};
