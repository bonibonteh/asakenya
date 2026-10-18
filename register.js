/* ASAKenya registration via Supabase Auth.
   Workflow: register -> verify email (if enabled) -> sign in -> an administrator approves access.
   Creating an account never grants staff privileges: this form only sends name, email and password. */
(function () {
'use strict';
var form=document.getElementById('asa-register-form'), out=document.getElementById('register-message');
if(!form||!window.ASA_DB)return;
var button=form.querySelector('button[type="submit"]'), label=button.textContent;
var busy=false, cooldownTimer=null;

function clearOut(){out.textContent='';out.style.color='';}
/* Show a message, optionally followed by sign-in / recovery links. Built with DOM nodes, never innerHTML. */
function say(text,ok,links){
  out.textContent='';out.style.color=ok?'#176638':'#b42318';
  out.appendChild(document.createTextNode(text));
  if(links){
    out.appendChild(document.createTextNode(' '));
    var a=document.createElement('a');a.href='/admin';a.textContent='Sign in';a.style.fontWeight='700';out.appendChild(a);
    out.appendChild(document.createTextNode(' or use '));
    var b=document.createElement('a');b.href='/admin';b.textContent='"Forgot your password?" on the sign-in page';b.style.fontWeight='700';out.appendChild(b);
    out.appendChild(document.createTextNode('.'));
  }
}
function setBusy(on){busy=on;button.disabled=on;button.setAttribute('aria-busy',on?'true':'false');button.textContent=on?'Creating account…':label;}
/* After a rate limit, keep the button off for a minute so people do not keep sending requests. */
function cooldown(seconds){
  var left=seconds;button.disabled=true;
  (function tick(){
    button.textContent='Try again in '+left+'s';
    if(left<=0){button.disabled=false;button.textContent=label;cooldownTimer=null;return;}
    left--;cooldownTimer=setTimeout(tick,1000);
  })();
}
function classify(err){
  var s=err&&err.status,c=String((err&&err.code)||'').toLowerCase(),m=String((err&&err.message)||'');
  if(c==='over_email_send_rate_limit'||c==='over_request_rate_limit'||s===429||/rate limit|too many|only request this after/i.test(m))return 'rate';
  if(c==='user_already_exists'||c==='email_exists'||/already registered|already exists|user already/i.test(m))return 'exists';
  if(c==='weak_password'||/password/i.test(m)&&s===422)return 'weak';
  if(c==='email_address_invalid'||c==='validation_failed'||/invalid.*email|email.*invalid/i.test(m))return 'email';
  if(c==='signup_disabled'||c==='email_provider_disabled'||/signups? (not allowed|disabled)/i.test(m))return 'disabled';
  if(err&&(err.code==='network'||s===0))return 'network';
  return 'other';
}
form.addEventListener('submit',async function(event){
  event.preventDefault();
  if(busy||cooldownTimer)return;                       /* ignores double clicks, Enter-key repeats and clicks during the cooldown */
  var name=form.elements.full_name.value.trim(),email=form.elements.email.value.trim(),password=form.elements.password.value,confirm=form.elements.confirm_password.value;
  clearOut();
  if(name.length<2){say('Please enter your full name.',false);return;}
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){say('Please enter a valid email address.',false);return;}
  if(password.length<8){say('Use a password with at least 8 characters.',false);return;}
  if(password!==confirm){say('The passwords do not match.',false);return;}
  setBusy(true);
  var result;
  try{
    /* One request only: no automatic retry (a retry would send a second email and count against the email limit). */
    result=await window.ASA_DB.request('/auth/v1/signup?redirect_to='+encodeURIComponent(location.origin+'/admin'),{method:'POST',body:{email:email,password:password,data:{full_name:name,name:name}}});
  }catch(error){
    setBusy(false);
    var kind=classify(error);
    if(kind==='rate'){
      say('Too many registration emails have been requested. Please wait before trying again. If you already have an account, sign in instead.',false,true);
      cooldown(60);
    }else if(kind==='exists'){say('An account already exists for this email.',false,true);}
    else if(kind==='weak'){say('That password is too easy to guess. Please choose a longer, less common password.',false);}
    else if(kind==='email'){say('That email address was not accepted. Please check it and try again.',false);}
    else if(kind==='disabled'){say('Registration is not open right now. Please contact an ASAKenya administrator.',false);}
    else if(kind==='network'){say('We could not reach the server, so we do not know whether your account was created. Please check your connection and try once. If it fails again, try signing in first.',false,true);}
    else{say('Registration did not go through. Please try again in a few minutes.',false);}
    return;                                            /* the form keeps what was typed and no success message is shown */
  }
  setBusy(false);
  /* Supabase answers an existing, confirmed email with a user that has no identities (so it does not reveal who has an account). */
  var user=result&&(result.user||(result.id?result:null));
  if(user&&Array.isArray(user.identities)&&user.identities.length===0){say('An account may already exist for this email.',false,true);return;}
  if(!user||!user.id){say('Registration did not go through. Please try again in a few minutes.',false);return;}
  form.reset();
  if(result.access_token){say('Your account has been created. Sign in to continue. Council and staff access stays pending until an administrator approves it.',true);}
  else{say('Almost done. Check your email for a verification link, then sign in. Council and staff access stays pending until an administrator approves it.',true);}
});
})();
