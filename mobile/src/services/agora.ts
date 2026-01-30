// Agora Video kütüphanesi Expo Go'da çalışmaz.
// Test için sahte bir servis oluşturduk.

export const initAgora = async () => {
  console.log("Agora Service: Init (Mock)");
};

export const joinChannel = async () => {
  console.log("Agora Service: Join Channel (Mock)");
  return true;
};

export const leaveChannel = async () => {
  console.log("Agora Service: Leave Channel (Mock)");
};