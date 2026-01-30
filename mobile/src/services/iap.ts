// react-native-iap kütüphanesini kaldırdığımız için geçici olarak devre dışı bıraktık.
// İleride Development Build aldığında burayı eski haline getirebilirsin.

export const initIAP = async () => {
  console.log("IAP Service: Init (Mock)");
};

export const purchaseItem = async (sku: string) => {
  console.log("IAP Service: Purchase (Mock)", sku);
  return true;
};

export const getProducts = async () => {
  console.log("IAP Service: Get Products (Mock)");
  return [];
};

export const endConnection = () => {
  console.log("IAP Service: End Connection (Mock)");
};