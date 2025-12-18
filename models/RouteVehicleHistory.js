module.exports = (sequelize, DataTypes) => {
  const RouteVehicleHistory = sequelize.define(
    'RouteVehicleHistory',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      route_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'routes',
          key: 'id',
        },
      },
      vehicle_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'vehicles',
          key: 'id',
        },
      },
      assigned_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      unassigned_date: {
        type: DataTypes.DATEONLY,
      },
      is_current: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: 'route_vehicle_history',
      timestamps: true,
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      indexes: [
        { fields: ['route_id'] },
        { fields: ['vehicle_id'] },
        { fields: ['is_current'] },
        { fields: ['assigned_date'] },
      ],
    }
  );

  return RouteVehicleHistory;
};
