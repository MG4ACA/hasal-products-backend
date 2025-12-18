module.exports = (sequelize, DataTypes) => {
  const RawMaterial = sequelize.define(
    'RawMaterial',
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
      category: {
        type: DataTypes.STRING(50),
      },
      unit: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      reorder_level: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
      },
    },
    {
      tableName: 'raw_materials',
      timestamps: true,
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      indexes: [
        { fields: ['code'] },
        { fields: ['name'] },
        { fields: ['category'] },
        { fields: ['status'] },
      ],
    }
  );

  return RawMaterial;
};
