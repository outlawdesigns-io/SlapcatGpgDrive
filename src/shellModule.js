/*
this share a lot of code with
https://github.com/outlawstar4761/mysql_googleDrive_autobackup_node/blob/master/src/mysqlModule.js
consider abstracting into some kind of npm package.
*/
var ShellModule = (function(){
  const fs = require('fs');
  const {exec} = require('child_process');
  const SLAPCATTEST = 'which slapcat';
  const GPGTEST = 'gpg --help | head -n 1';

  let _outDir = null;

  function _execShellCmd(cmd){
    return new Promise((resolve,reject)=>{
      exec(cmd,(err,stdout,stderr)=>{
        if(err) reject(err);
        if(stderr) reject(stderr);
        resolve(stdout);
      });
    });
  }
  async function _testSlapcat(){
    let cmd = SLAPCATTEST;
    let stdout = '';
    try{
      stdout = await _execShellCmd(cmd);
    }catch(err){
      throw err;
      return;
    }
    return stdout;
  }
  async function _testGpg(){
    let cmd = GPGTEST;
    let stdout = '';
    try{
      stdout = await _execShellCmd(cmd);
    }catch(err){
      throw err;
      return;
    }
    return stdout;
  }
  function _getOutPath(filename){
    return _outDir + filename + '.ldif';
  }
  function _getEncryptedPath(filename){
    return _getOutPath(filename) + '.gpg';
  }
  async function _deleteFile(absolutePath){
    let cmd = 'rm ' + absolutePath;
    return _execShellCmd(cmd);
  }
  async function _encryptOutput(absolutePath,passphrase){
    let cmd = 'gpg -c --batch --passphrase=' + passphrase + ' ' + absolutePath;
    await _execShellCmd(cmd);
    return _deleteFile(absolutePath);
  }
  async function _decryptOutput(absolutePath,passphrase){
    let cmd = 'gpg --yes --batch --passphrase=' + passphrase + ' ' + absolutePath + ' 2>/dev/null';
    await _execShellCmd(cmd);
    return _deleteFile(absolutePath);
  }
  async function _backupLDAPSchema(domainName,schemaStr){
    //there's a term-of-art for 'schemaStr'. Not sure what it is.
    let outfile = `${_outDir}${domainName}.ldif`;
    let cmd = `slapcat -b "${schemaStr}" -l ${outfile}`;
    return _execShellCmd(cmd);
  }
  async function _emptyOutDir(){
    if(_outDir === null){
      throw new Error('Cannot empty output directory before setting it.');
    }
    let cmd = `rm ${_outDir}*.*`;
    return _execShellCmd(cmd);
  }
  return {
    outDir:_outDir,
    setOutputDir:function(absolutePath){
      let pathToSet = absolutePath.lastIndexOf('/') == (absolutePath.length - 1) ? absolutePath:`${absolutePath}/`
      try{
        if(!fs.existsSync(pathToSet)){
          fs.mkdirSync(pathToSet);
        }
      }catch(err){
        throw err;
        return;
      }
      _outDir = pathToSet;
      this.outDir = _outDir;
    },
    testShellAccess:async function(){
      let slapcatout = await _testSlapcat();
      let gpstdout = await _testGpg();
      return {'slapcat':slapcatout,'gpg':gpstdout};
    },
    backupLDAPSchema:async function(domain,schemaStr){
      return _backupLDAPSchema(domain,schemaStr);
    },
    getOutPath:function(filename){
      return _getOutPath(filename);
    },
    getEncryptedPath:function(filename){
      return _getEncryptedPath(filename);
    },
    encryptOutput:async function(absolutePath,passphrase){
      return await _encryptOutput(absolutePath,passphrase);
    },
    decryptOutput: async function(absolutePath,passphrase){
      return _decryptOutput(absolutePath,passphrase);
    },
    cleanup:async function(){
      return _emptyOutDir();
    }
  }
}());

module.exports = ShellModule;
