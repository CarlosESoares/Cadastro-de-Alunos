document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById('loginModal');
    const openBtn = document.getElementById('openModal');
    const closeBtn = document.getElementById('closeModal');

    if (openBtn) {
        openBtn.onclick = () => modal.showModal();
    }

    if (closeBtn) {
        closeBtn.onclick = () => modal.close();
    }


    modal.onclick = (e) => {
        const rect = modal.getBoundingClientRect();
        const isInDialog = (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
        );
        if (!isInDialog) {
            modal.close();
        }
    };


    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('login_error')) {

        setTimeout(() => {
            modal.showModal();l
        }, 100);
        
        window.history.replaceState({}, document.title, "/");
    }
});