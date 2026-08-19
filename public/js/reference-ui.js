(()=>{'use strict';
function closeDiscover(e){const top=document.querySelector('.topchrome');if(!top?.classList.contains('discover-open'))return;if(e.target.closest('.mockup-discover,#chips'))return;top.classList.remove('discover-open')}
document.addEventListener('click',closeDiscover,true);
})();