// Rust kabuğu (lib.rs) açılış durumunu buradan günceller.
window.rutinfitSplash = {
  update: function (message, isError) {
    document.getElementById("status").textContent = message;
    document.getElementById("card").classList.toggle("error", !!isError);
  },
};
