// no react imports here, the server-rendered AppShell includes the script

export const SIDEBAR_KEY = "flux.sidebar";
export const ONBOARDED_KEY = "flux-onboarded";

// runs before hydration, see the data-sidebar and data-onboarded rules in globals.css
export const SIDEBAR_BOOT_SCRIPT = `try{var d=document.documentElement.dataset;if(localStorage.getItem("${SIDEBAR_KEY}")==="collapsed")d.sidebar="collapsed";if(localStorage.getItem("${ONBOARDED_KEY}")==="1")d.onboarded=""}catch(e){}`;
