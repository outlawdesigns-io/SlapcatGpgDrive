const path = require('path');
const GoogleDrive = require('outlawdesigns.io.googledrive');
const ShellModule = require('./src/shellModule');
const config = require('./config/config');

async function testShell(){
  let requirementTestResults;
  try{
    requirementTestResults = await ShellModule.testShellAccess();
  }catch(err){
    console.log('Requirement check failed. Quitting...');
    console.error(err);
    process.exit(1);
  }
}
function parseExistingBackups(fileList){
  let ids = [];
  fileList.forEach((file)=>{
    if(file.name.match(/.ldif.gpg/)){
      ids.push(file.id);
    }
  });
  return ids;
}
async function pruneOldBackUps(auth){
  let fileList = await GoogleDrive.getFileList(auth,{}).catch((err)=>{throw err; return});
  let backupIds = parseExistingBackups(fileList);
  for(i in backupIds){
    await GoogleDrive.deleteFile(auth,backupIds[i]).catch((err)=>{throw err; return});
  }
}
function quitWithError(err){
  console.error(err);
  process.exit(1);
}

(async ()=>{
  await testShell();
  let outdir = `${__dirname}/out/`;
  try{
    ShellModule.setOutputDir(outdir);
  }catch(err){
    quitWithError(err);
  }
  let auth = GoogleDrive.authorize(__dirname + '/config/ldap-autobackups-16f84373eaef.json',['https://www.googleapis.com/auth/drive']);
  try{
    await pruneOldBackUps(auth);
    console.log('Pruned existing backup...');
  }catch(err){
    quitWithError(err);
  }
  try{
    await ShellModule.backupLDAPSchema(config.ldapDomain,config.ldapSchema);
    console.log(`Backed up schema ${config.ldapDomain}...`);
  }catch(err){
    quitWithError(err);
  }
  try{
    await ShellModule.encryptOutput(ShellModule.getOutPath(config.ldapDomain),config.encryptionPhrase);
    console.log(`Encrypted schema ${config.ldapDomain}...`);
  }catch(err){
    quitWithError(err);
  }
  try{
    let pathToFile = ShellModule.getEncryptedPath(config.ldapDomain);
    let fileMetaData = {name:path.basename(pathToFile),parents:config.googleParentFolders};
    await GoogleDrive.uploadFile(auth,pathToFile,fileMetaData);
    console.log(`Uploaded ${path.basename(pathToFile)} to GoogleDrive...`);
  }catch(err){
    quitWithError(err);
  }
  try{
    await ShellModule.cleanup();
  }catch(err){
    quitWithError(err);
  }
})();
