export const isIOSLikeDevice=(navigatorLike=globalThis.navigator)=>{
 const userAgent=String(navigatorLike?.userAgent||'');
 const platform=String(navigatorLike?.platform||'');
 const touchPoints=Number(navigatorLike?.maxTouchPoints)||0;
 return /iPad|iPhone|iPod/i.test(userAgent)||(platform==='MacIntel'&&touchPoints>1);
};

export const scoreTableDownloadMode=navigatorLike=>isIOSLikeDevice(navigatorLike)?'preview':'download';
