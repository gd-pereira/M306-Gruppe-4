// no react imports here, the server-rendered AppShell includes the script

export const SIDEBAR_KEY = "flux.sidebar";

// runs before hydration, see the data-sidebar rules in globals.css
export const SIDEBAR_BOOT_SCRIPT = `try{if(localStorage.getItem("${SIDEBAR_KEY}")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;
