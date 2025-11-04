import { DB_ERR_CODES, prisma } from '../prisma/db.mjs';

const getProducts = async (req, res, next) => {
  // const products = await prisma.product.findMany();

  const products = await prisma.product.findMany({
    include: {
      inventory: {
        select: { quantity: true },
      },
      entry: {
        orderBy: { entryDate: 'desc' },
        take: 1, // get only the latest entry (for latest price)
        select: { price: true, quantity: true },
      },
    },
  });

  res.json({ message: 'Products retrieved successfully', products });
};

const getAllInventory = async (req, res, next) => {
  try {
    const inventories = await prisma.inventory.findMany({
      include: {
        product: {
          select: {
            name: true,
            category: true,
            minQuantity: true,
            entry: {
              orderBy: { entryDate: 'desc' },
              take: 1, // get only the latest entry (for latest price)
              select: { price: true },
            },
          },
        },
      },
    });

    res.json({ message: 'All inventories', inventories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching inventories', error });
  }
};

const getAllUsers = async (req, res, next) => {
  const allUsers = await prisma.user.findMany();

  res.json({ message: 'All Team Members', allUsers });
};

// const addProduct = async (req, res, next) => {
//   try {
//     const { name, skuId, description, minQuantity, category } = req.body;

//     // Step 1: Create the Product
//     const product = await prisma.product.create({
//       data: {
//         name,
//         skuId,
//         description,
//         minQuantity,
//         category,
//       },
//     });

//     // Step 2: Automatically create Inventory record for this product
//     const inventory = await prisma.inventory.create({
//       data: {
//         productId: product.id,
//         quantity: 0, // default quantity
//         location: null, // or set default if you have one
//       },
//     });

//     console.log({ product, inventory });

//     // Step 3: Respond
//     res.json({
//       message: 'Product and inventory created successfully',
//       product,
//       inventory,
//     });
//   } catch (error) {
//     console.error('Error adding product:', error);
//     next(error);
//   }
// };

const addProduct = async (req, res, next) => {
  try {
    const { name, price, skuId } = req.body;

    //Check karo ki same SKU already exist to nhi karta

    const existingProduct = await prisma.product.findUnique({
      where: { skuId: skuId },
    });
    if (existingProduct) {
      return res.status(400).json({
        massage: 'Product with this SKU already exists!',
      });
    }
    // Agar unique hai, naya product create karo
    const newProduct = await prisma.product.create({
      data: {
        name,
        price,
        skuId,
      },
    });

    res.status(200).json({
      massage: 'Product added successfully',
      product: newProduct,
    });
  } catch (error) {
    console.error('Error in addProduct:', error);
    res
      .status(500)
      .json({ massage: 'Internal Server Error', error: error.massage });
  }
};

// const productEntry = async (req, res, next) => {
//   const { productId, quantity, price, notes, addedBy } = req.body;

//   console.log(req.body); // ✅ check these are not undefined

//   // When adding an entry
//   const newEntry = await prisma.$transaction(async (tx) => {
//     await tx.entry.create({
//       data: { productId, quantity, price, notes, addedBy },
//     });

//     await tx.inventory.upsert({
//       where: { productId: productId },
//       update: { quantity: { increment: quantity } },
//       create: { productId: productId, quantity: quantity },
//     });
//   });

//   res.json({ message: 'Product entry recorded successfully', newEntry });
// };

const productEntry = async (req, res, next) => {
  try {
    const { productId, quantity, price, notes, addedBy } = res.body;
    //Phale check karo ki product exitstnhi hai

    const product = await prisma.product.findMany({
      where: { id: productId },
    });

    if (!product) {
      return res.status(400).json({
        massage: `Product with id ${productId} does not exist!`,
      });
    }

    //Transacton start karo entry create + inventory update

    const result = await prisma.$transaction(async (tx) => {
      // Entry create karo

      const newEntry = await tx.entry.create({
        data: { productId, quantity, price, notes, addedBy },
      });

      //Inventory update karo (upsert)

      await tx.inventory.upsert({
        where: { productId },
        update: { quqntity: { incrememt: quantity } },
        create: { productId, quantity },
      });
      return newEntry;
    });

    res.status(200).json({
      massage: 'Product entry recorded successfully',
      entry: result,
    });
  } catch (error) {
    console.error('Error in productEntry:', error);
    res.status(500).json({
      error: error.massage,
    });
  }
};

const productExit = async (req, res, next) => {
  const { productId, quantity, price, reason, removedBy } = req.body;

  console.log(req.body); // ✅ check these are not undefined

  const exitItem = await prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.findUnique({
      where: { productId: productId },
      select: { quantity: true },
    });

    if (!inventory || inventory.quantity < quantity) {
      throw new Error('Not enough stock to remove');
    }

    const exit = await tx.exit.create({
      data: { productId, quantity, price, reason, removedBy },
    });

    await tx.inventory.update({
      where: { productId: productId },
      data: { quantity: { decrement: quantity } },
    });

    return exit;
  });

  res.json({ message: 'Product exit recorded successfully', exitItem });
};

export {
  getProducts,
  getAllInventory,
  getAllUsers,
  addProduct,
  productEntry,
  productExit,
};
