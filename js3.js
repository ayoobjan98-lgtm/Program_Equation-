document.addEventListener("DOMContentLoaded", function() {
  const STORAGE_KEY = "object";
  const container = document.getElementById("favContainer");
  
  // ---- دریافت داده ----
  let data = [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    data = stored ? JSON.parse(stored) : [];
  } catch (e) {
    data = [];
  }
  
  // ---- فیلتر آیتم‌های لایک شده ----
  const likedItems = data.filter(item => item.like === true);
  
  // ---- رندر ----
  function renderFavorites() {
    if (likedItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="icon">💔</span>
          <p>هیچ معادله‌ای رو لایک نکردی</p>
          <p style="font-size:14px; color:#b2bec3;">برو به صفحه خانه و روی قلب ❤️ بزن تا اینجا نمایش داده بشه</p>
        </div>
      `;
      return;
    }
    
    let html = "";
    // برای نمایش ایندکس اصلی (آیتم اصلی در آرایه data)
    likedItems.forEach((item, idx) => {
      // ایندکس واقعی در آرایه data رو پیدا می‌کنیم
      const realIndex = data.indexOf(item);
      html += `
        <div class="equation-card" data-realindex="${realIndex}">
          <div class="eq-title">❤️ ${item.title || 'معادله'}</div>
          <div class="eq-text">${item.text || ''}</div>
          <div class="eq-actions">
            <button class="btn-delete" data-action="unlike" data-realindex="${realIndex}">
              حذف از علاقه‌مندی ❌
            </button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }
  
  // ---- مدیریت رویدادها ----
  container.addEventListener("click", function(e) {
    const target = e.target.closest("button");
    if (!target) return;
    
    const action = target.dataset.action;
    const realIndex = parseInt(target.dataset.realindex);
    if (isNaN(realIndex)) return;
    
    if (action === "unlike") {
      const confirmed = confirm("آیا از علاقه‌مندی‌ها حذف بشه؟");
      if (!confirmed) return;
      
      data[realIndex].like = false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      
      // حذف کارت از صفحه (بدون رفرش کامل)
      const card = target.closest(".equation-card");
      if (card) card.remove();
      
      // اگر هیچ موردی باقی نمونده، پیام خالی نمایش بده
      const remaining = document.querySelectorAll(".equation-card");
      if (remaining.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="icon">💔</span>
            <p>لیست علاقه‌مندی‌ها خالی شد</p>
          </div>
        `;
      }
    }
  });
  
  // ---- اجرا ----
  renderFavorites();
});
