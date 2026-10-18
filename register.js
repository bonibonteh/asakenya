/* ASAKenya registration via existing Supabase Auth configuration. */
(function () {
'use strict';
var form=document.getElementById('asa-register-form'), out=document.getElementById('register-message');
if(!form||!window.ASA_DB)return;
form.addEventListener('submit',async function(event){
event.preventDefault();var button=form.querySelector('button[type="submit"]');
var name=form.elements.full_name.value.trim(),email=form.elements.email.value.trim(),password=form.elements.password.value,confirm=form.elements.confirm_password.value;
out.textContent='';if(name.length<2){out.textContent='Please enter your full name.';return;}
if(password.length<8){out.textContent='Use a password with at least 8 characters.';return;}
if(password!==confirm){out.textContent='The passwords do not match.';return;}
button.disabled=true;button.textContent='Creating account…';
try{
var result=await window.ASA_DB.request('/auth/v1/signup',{method:'POST',body:{email:email,password:password,data:{full_name:name,name:name}}});
form.reset();
out.textContent=result&&result.access_token?'Welcome to ASAKenya! Your account has been created. You can now sign in. Staff/admin access still requires approval.':'Welcome to ASAKenya! Registration was received. Check your email for a verification link if email confirmation is enabled. After verification, sign in. Staff/admin access requires approval.';
out.style.color='#176638';
}catch(error){var msg=error&&error.message?error.message:'Registration failed. Please try again.';if(/already registered|already exists|user already/i.test(msg))msg='An account may already exist for this email. Try signing in or use password recovery.';out.textContent=msg;out.style.color='#b42318';}
finally{button.disabled=false;button.textContent='Create account';}
});
})();