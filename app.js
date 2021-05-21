//Declaration et initialisation de tout les modules a utiliser dans le programmes
var finalhandler = require('finalhandler')
var serveIndex = require('serve-index')
var serveStatic = require('serve-static')


const express = require('express')

var index = serveIndex('clickable_files/', {'icons': true})
// Serve up public/ftp folder files
var serve = serveStatic('clickable_files/')

var http = require('http');
var formidable = require('formidable');
var fs = require('fs');
var path = require('path');
var extra_fs = require('fs-extra');
var port = process.env.port || 8080
//Declaration des variables globales
var FILE_NAME = ''; //variable pour stocker le nom de fichier a traiter
var OUTPUT_FILE_NAME = ''; //variable pour stocker le nom de fichier traiter qui sort dans le dossier redacted files
var OUTPUT_FILE_NAME_CLICK = ''; //variable pour stocker le nom de fichier traiter qui sort dans le dossier clickable files
var selected_files = []; //un array pour stocker tout les fichiers pdf dans le dossier selectionner
var pdfpath_redacted; // variable pour le nom de chaque fichier traités + le mot redacted
var pdfpath_clickable; // variable pour le nom de chaque fichier traités + le mot clickable
var Time = 0; //Variable time pour un time quoi
var numBtn = 1; //Variable numbtn a utiliser pour le numero de button (a voir dans la fonction button_redacted)

var dir_home = process.env [process.platform =="win32"?"USERPROFILE":"HOME"];
var dir_desktop = require("path").join(dir_home, "Desktop","Download");

var redacted_files_directory = require("path").join(dir_home, "Desktop","Redacted");; //variable pour le dossier a vider a chaque fois que le programme commence a traiter un dossier selectionné
var clickable_files_directory = require("path").join(dir_home, "Desktop","Clickable");; //variable pour le dossier a vider a chaque fois que le programme commence a traiter un dossier selectionné

// fonction pour ecrire dans un fichier progress.txt (utile pour le loading sur l'interface)
function progress(value) {
    let fs = require('fs');
    return fs.writeFileSync('./public/progress.txt', `${value}`);
}

http.createServer(function (req, res) {
    
    //Quand l'utilisateur click sur le bouton traitement l'url / fileupload va etre demander
    if (req.url == '/fileupload') {
        // variables à reinitialiser
        FILE_NAME = '';
        OUTPUT_FILE_NAME = '';
        OUTPUT_FILE_NAME_CLICK = '';
        selected_files = [];
        pdfpath_redacted;
        Time = 20000;
        numBtn = 1;
        // Utilisation de module formidable pour prendre les fichier dans le dossier selectionnes
        let form = new formidable.IncomingForm();
        form.on('file', function(field, file) {
            //Insertion des fichiers pdf dans l'array selected_files
            if (file.type === 'application/pdf')
                selected_files.push(file);
        });

        form.parse(req, async function(err, fields, files) {
            if (fields.btn1 == '') {
                //Demarrage du traitement
                extra_fs.emptyDirSync(redacted_files_directory); //Vidage du dossier redacted_files
                extra_fs.emptyDirSync(clickable_files_directory); //Vidage du dossier clickables_files
                progress(0); //Ecrire 0 dans le fichier progress.txt
                if (selected_files.length === 0) {
                    console.log('Aucun fichier PDF...')
                } else {
                    //Basculer l'index html en load html pour suivre la progression du traitement
                    req.url = '/load';
                    HTML('/load', './public/load.html');
                    for (let file of selected_files) {
                        if (file !== undefined) {
                            setTimeout(async () => {

                                let arr = file.name.split('/');
                                FILE_NAME = arr[arr.length - 1];
                                OUTPUT_FILE_NAME = FILE_NAME.split('.pdf')[0] + '_redacted.pdf';
                                OUTPUT_FILE_NAME_CLICK = FILE_NAME.split('.pdf')[0] + '_clickable.pdf';
                                pdfpath_redacted = path.join(redacted_files_directory,OUTPUT_FILE_NAME)
                                pdfpath_clickable = path.join(clickable_files_directory,OUTPUT_FILE_NAME_CLICK);
                                await create_redaction(file.path); //une fonction pour traiter un fichier
                            }, Time); //Une fonction setTimeout de 10 seconde pour s'assurrer que le traitement du fichier soit bien fini (un fichier = 20 seconde)
                            //NB: Sur cette fonction si un ou plusieurs fichiers presente des champs non traitéés, il faudra augmenter le time
                            Time += 20000;
                        }
                    }
                    let current_nbr_file = 0; //variable pour compter les fichiers deja traites
                    const counter = setInterval(() => {
                        fs.readdir(clickable_files_directory, function(err, files) {
                            if (files.length != current_nbr_file) {
                                console.log(files.length + (!(files.length > 1) ? ' fichier traité' : ' fichiers traités'));
                                progress(files.length); //Ecrire le nombre de fichier traités dans progress.txt
                            }
                            current_nbr_file = files.length;
                            if (files.length >= selected_files.length) {
                                clearInterval(counter);
                                console.log('** Redaction terminée... **');
                            }
                        });
                    }, 1000);
                }
            }
        });
    } else if (req.method == 'GET' && req.url == '/progress.txt') {
        //Ecrire ce qui est dans le fichier progress.txt pour l'interface load.html
        res.writeHead(200, { 'content-type': 'text/plain' });
        fs.readFile('./public/progress.txt', 'utf8', function(err, data) {
            if (err) {
                return console.log(err);
            } else {
                res.writeHeader(200, { "Content-Type": "text/plain" });
                res.write(data);
                res.end();
            }
        });
    }
    else {
        if (req.url === "/") {
            fs.readFile("./public/index.html", "UTF-8", function(err, data) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            });
        } else if (req.url.match("\.css$")) {
            var cssPath = path.join(__dirname, 'public', req.url);
            var fileStream = fs.createReadStream(cssPath);
            res.writeHead(200, { 'Content-Type': "text/css" });
            fileStream.pipe(res);
        } else if (req.url.match("\.js$")) {
            var jsPath = path.join(__dirname, 'public', req.url);
            var fileStream = fs.createReadStream(jsPath);
            res.writeHead(200, { 'Content-Type': "text/js" });
            fileStream.pipe(res);
        }
    }

    var HTML = function(url, html_path) {
        if (req.url === url) {
            fs.readFile(html_path, "UTF-8", function(err, data) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            });
        } else if (req.url.match("\.css$")) {
            var cssPath = path.join(__dirname, 'public', req.url);
            var fileStream = fs.createReadStream(cssPath);
            res.writeHead(200, { 'Content-Type': "text/css" });
            fileStream.pipe(res);
        } else if (req.url.match("\.js$")) {
            var jsPath = path.join(__dirname, 'public', req.url);
            var fileStream = fs.createReadStream(jsPath);
            res.writeHead(200, { 'Content-Type': "text/js" });
            fileStream.pipe(res);
        }
    }
}).listen(process.env.port || 8080); // port pour appeler le serveur app.js

// PDF REDACTION
const { PDFNet } = require('@pdftron/pdfnet-node');
const { Console } = require('console');

async function create_redaction(pdffile) {
//Pattern1 : pattern pour le numero de telephone en Belgique
    let pattern1 = "[+]3{1}2{1}+[ ]{0,1}+[.]{0,1}+[-]{0,1}+\\d{1}+[ ]{0,1}+[.]{0,1}+[-]{0,1}+\\d{3}+[ ]{0,1}+[-]{0,1}+[.]{0,1}+\\d{2}+[ ]{0,1}+[.]{0,1}+[-]{0,1}+\\d{2}+\\d{0,1}";
    await search_redact(pattern1);

//Pattern2 : pattern pour l'email 
    let pattern2 = "[a-zA-Z0-9._%+-]+[a-zA-Z0-9._%+-]+@[A-z]+[a-zA-Z0-9._%+-]+[a-zA-Z]";
    await search_redact(pattern2);
    
//IBAN PATERN : patern pour reconnaitre le code IBAN 
    let iban_patern ="[A-Z]{2}[ ]{0,1}[0-9]{2}[ ]{0,1}[0-9 ]{11,30}";
    await search_redact(iban_patern);

//TVA PATERN : patern pour reconnaitre le TVA
// let tva_patern = "[A-Z]{2}+[ ]{0,1}+[0-9]{4}+[ ]{0,1}+[0-9]{3}+[ ]{0,1}+[0-9]{3}";
    let tva_patern = "[A-Z]{2}[ ]{0,1}[0-9]{4}[^A-Za-z0-9_]{0,1}[0-9]{3}[^A-Za-z0-9_]{0,1}[0-9]{3}";
    await search_redact(tva_patern);

//adress PATERN : patern pour reconnaitre le l'adresse
    let codeform2 = "([1-9]{1}[0-9]{3}[ ]{0,1}[A-Z]{1}[A-Za-z]{2,12})";
    let codeform1 = "[A-Z]{2}+[-]+[0-9]{4}+[ ]+[A-Z]{1,}";
    await search_redact(codeform1);
    await search_redact(codeform2);

//patern numero permis de conduire
    const permis = /[1-9]{2}[ .]{0,1}(?:1[0-2]|0[0-9]{1})[ .]{0,1}[0-9]{2}[ .]{0,1}[0-9]{2}[ .]{0,1}[0-9]{4}/g
    await search_redact(permis);
//patern numero CIN
    const cin = /[0-9]{2}[.](?:1[0-2]|0[0-9]{1})[.](?:3[0-1]|0[1-9]{1}|2[0-9]{1})-[0-9]{3}[.][0-9]{2}/g
    await search_redact(cin);
//identificaiton employer
    const employer = /\b(?:[1-9]{1}[0-9]{11})\b/g
    await search_redact(employer);
//identification passport
    const passport = /\b(?:[A-Z]{2}[0-9]{6})\b/g
    await search_redact(passport);
//numero voiture
    const numVoiture = /\b(?:[1-8]{1}[-][A-Y]{1}[A-Z]{2}[-][0-9]{3})\b/g
    await search_redact(numVoiture);
//NIV voiture
    const nivVehicule = /\b(?:(?:[0-9]|[A-H]|[J-N]|[P]|[R-Z]){8}(?:[0-9]|[X]){1}(?:[1-9]|[A-H]|[J-N]|[P]|[R-T]|[V-Y]){1}(?:[0-9]|[A-H]|[J-N]|[P]|[R-Z]){1}[0-9]{6})\b/g
    await search_redact(nivVehicule);
//url patern
    let url_patern = "(?:[https:\/\/www.|http:\/\/www.|https:\/\/|http:\/\/|www]+[.]+[a-zA-Z0-9._%+-\/]+[a-zA-Z0-9._%+-])"
    await search_redact(url_patern);

   
    //patern pour une ville a belge
    // let ville = "\w+[0-9][ ]{1}\w+[A-Za-z]$";
    // await search_redact(ville);

    var inputPath_redacted = pdffile; // pdf a chercher
    var inputPath_clickable = pdffile; // pdf a chercher
    //Fonction pour chercher un mot dans le pdf
    function search_redact(pattern) {
        const main = async() => {
            try {
                const doc = await PDFNet.PDFDoc.createFromUFilePath(pdffile);
                doc.initSecurityHandler();
                doc.lock();
                const txtSearch = await PDFNet.TextSearch.create();
                let mode = (PDFNet.TextSearch.Mode.e_whole_word | PDFNet.TextSearch.Mode.e_highlight) + PDFNet.TextSearch.Mode.e_reg_expression;
                txtSearch.begin(doc,pattern, mode);
                let result = await txtSearch.run();
                while (true) {

                    if (result.code === PDFNet.TextSearch.ResultCode.e_found) {
                        let hlts = result.highlights;
                        hlts.begin(doc);
                        while ((await hlts.hasNext())) {
                            const quadArr = await hlts.getCurrentQuads();
                            for (let i = 0; i < quadArr.length; ++i) {
                                //Coordonnée du mot trouvé dans le pdf 
                                const currQuad = quadArr[i];
                                const x1 = Math.min(Math.min(Math.min(currQuad.p1x, currQuad.p2x), currQuad.p3x), currQuad.p4x);
                                const x2 = Math.max(Math.max(Math.max(currQuad.p1x, currQuad.p2x), currQuad.p3x), currQuad.p4x);
                                const y1 = Math.min(Math.min(Math.min(currQuad.p1y, currQuad.p2y), currQuad.p3y), currQuad.p4y);
                                const y2 = Math.max(Math.max(Math.max(currQuad.p1y, currQuad.p2y), currQuad.p3y), currQuad.p4y);
                                redact_create(x1, y1, x2, y2, result.page_num); //Mettre un redact dans le coordonnée designé
                                button_create(x1, y1, x2, y2, result.page_num); //Mettre un masque clickable dans le coordonnée designé
                                break;
                            }
                            hlts.next();
                            break;
                        }
                        while (await hlts.hasNext()) {
                            await hlts.next();
                        }
                    } else if (result.code === PDFNet.TextSearch.ResultCode.e_page) {
                        ////////////////////////////////////////
                    } else if (result.code === PDFNet.TextSearch.ResultCode.e_done) {
                        ///////////////////////////////////////
                        break;
                    }
                    result = await txtSearch.run();
                }
            } catch (err) {
                console.log(err);
            }
            //Fonction pour redacter
            function redact_create(x1, y1, x2, y2, page_num) {
                ((exports) => {
                    exports.runPDFRedactTest = () => {
                        const main = async() => {
                            try {
                                const doc = await PDFNet.PDFDoc.createFromFilePath(inputPath_redacted);
                                doc.initSecurityHandler();
                                const redactionArray = []; // we will contain a list of redaction objects in this array
                                redactionArray.push(await PDFNet.Redactor.redactionCreate(page_num, (await PDFNet.Rect.init(x1, y1, x2, y2)), false, ''));
                                const appear = {};
                                appear.redaction_overlay = true;
                                //const greenColorPt = await PDFNet.ColorPt.init(0, 0, 1, 0);
                                //appear.positive_overlay_color = greenColorPt;
                                appear.border = true;
                                const timesFont = await PDFNet.Font.create(doc, PDFNet.Font.StandardType1Font.e_times_roman);
                                appear.font = timesFont;
                                appear.show_redacted_content_regions = true;
                                PDFNet.Redactor.redact(doc, redactionArray, appear, false, false);
                                // output
                                await doc.save(pdfpath_redacted, PDFNet.SDFDoc.SaveOptions.e_linearized);
                                inputPath_redacted = pdfpath_redacted;
                            } catch (err) {
                                console.log(err.stack);
                            }
                        };
                        // add your own license key as the second parameter, e.g. PDFNet.runWithCleanup(main, 'YOUR_LICENSE_KEY')
                        PDFNet.runWithCleanup(main).then(function() { PDFNet.shutdown(); });
                    };
                    exports.runPDFRedactTest();
                })(exports);
            }
            // Fonction pour creer un bouton
            function button_create(x1, y1, x2, y2, page_num) {
                ((exports) => {

                    exports.runPDFRedactTest = () => {

                        const main = async() => {
                            try {
                               
                                const doc = await PDFNet.PDFDoc.createFromFilePath(inputPath_clickable);
                                doc.initSecurityHandler();
                                const blankPage = await doc.getPage(page_num);

                                const btn_field = await doc.fieldCreate("button." + numBtn, PDFNet.Field.Type.e_button);
                                const btnbox = await (await PDFNet.PushButtonWidget.createWithField(doc, await PDFNet.Rect.init(x1, y1, x2, y2), btn_field))
                                fields = ["button." + numBtn];
                                await btnbox.setAction(await PDFNet.Action.createHideField(doc, fields))
                                await btnbox.setBackgroundColor(await PDFNet.ColorPt.init(1, 0, 1), 3);
                                //await btnbox.setMouseDownCaptionText("my text")
                                
                                btnbox.refreshAppearance();
                                blankPage.annotPushBack(btnbox);

                                numBtn++;
                                await doc.save(pdfpath_clickable, PDFNet.SDFDoc.SaveOptions.e_linearized);

                                inputPath_clickable = pdfpath_clickable;
                            } catch (err) {
                                console.log(err.stack);
                                ret = 1;
                            }
                        };
                        // add your own license key as the second parameter, e.g. PDFNet.runWithCleanup(main, 'YOUR_LICENSE_KEY')
                        PDFNet.runWithCleanup(main).then(function() { PDFNet.shutdown(); });
                    };
                    exports.runPDFRedactTest();
                })(exports);
            }
        }
        PDFNet.runWithCleanup(main).catch((err) => {
            console.log(err);
        }).then(() => {
            PDFNet.shutdown();
        });
    }
}
