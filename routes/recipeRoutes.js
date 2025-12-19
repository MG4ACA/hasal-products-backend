const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const authMiddleware = require('../middleware/authMiddleware');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authMiddleware);

// Recipe routes
router.get('/', recipeController.getAllRecipes);
router.get('/:id', recipeController.getRecipeById);
router.post('/', roleCheck(['admin', 'manager']), recipeController.createRecipe);
router.put('/:id', roleCheck(['admin', 'manager']), recipeController.updateRecipe);
router.delete('/:id', roleCheck(['admin']), recipeController.deleteRecipe);

// Version history
router.get('/:id/versions', recipeController.getRecipeVersions);

// Recipe item routes
router.post('/:id/items', roleCheck(['admin', 'manager']), recipeController.addRecipeItem);
router.put(
  '/:recipeId/items/:itemId',
  roleCheck(['admin', 'manager']),
  recipeController.updateRecipeItem
);
router.delete(
  '/:recipeId/items/:itemId',
  roleCheck(['admin', 'manager']),
  recipeController.deleteRecipeItem
);

module.exports = router;
