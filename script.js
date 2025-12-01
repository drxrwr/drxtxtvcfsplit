// ============================
// DEKLARASI FIX UPLOADED FILES
// ============================
let uploadedFiles = [];

document.getElementById("uploadInput").addEventListener("change", function (e) {
  const files = e.target.files;
  uploadedFiles = [];

  for (let i = 0; i < files.length; i++) {
    uploadedFiles.push(files[i]);
  }
});


// ======================================================
// ================  SPLIT VCF BUTTON  ==================
// ======================================================

document.getElementById("splitVCFButton").addEventListener("click", async function () {

  const rawNumbers = document.getElementById("numberTextArea").value.trim();
  const nameBaseInput = document.getElementById("contactNameInput").value.trim();

  let contactsPerFileInput = document.getElementById("contactsPerFile").value;
  let contactsPerFile = parseInt(contactsPerFileInput);
  if (isNaN(contactsPerFile) || contactsPerFile <= 0) contactsPerFile = null;

  const startNumberRaw = document.getElementById("startNumberInput").value;
  let startNumber = parseInt(startNumberRaw);

  const fileNameRawInput = document.getElementById("splitFileNameInput").value;
  const additionalFileNameRaw = document.getElementById("additionalFileNameInput").value;

  const useCustomName = document.getElementById("customNameCheckbox").checked;

  // FIX: CEK INPUT + UPLOAD
  if (!rawNumbers && uploadedFiles.length === 0) {
    alert("Isi daftar nomor atau upload file terlebih dahulu.");
    return;
  }

  // FIX: sumber file aman
  const fileSources = uploadedFiles.length > 0
    ? uploadedFiles
    : [{ name: "pasted.txt", isSynthetic: true }];

  // BACA FILE
  const results = await Promise.all(
    fileSources.map((file) => {
      return new Promise((resolve) => {

        // dari textarea
        if (file.isSynthetic) {
          const lines = rawNumbers.split(/\r?\n/).map(l => l.trim()).filter(l => l);
          resolve({ name: file.name, lines });
          return;
        }

        // dari upload
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target.result || "";

          if (file.name.toLowerCase().endsWith(".vcf")) {
            const nums = extractNumbersFromText(content);
            resolve({ name: file.name, lines: nums });
            return;
          }

          const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l);
          resolve({ name: file.name, lines });
        };
        reader.readAsText(file);
      });
    })
  );

  const outputDiv = document.getElementById("splitVcfFiles");
  outputDiv.innerHTML = "";
  const zip = new JSZip();

  // ======================================================
  // FIX PENTING: GLOBAL COUNTER TIDAK PERNAH RESET
  // ======================================================
  let globalCounter = isNaN(startNumber) ? 1 : startNumber;


  // ======================================================
  // PROSES TIAP FILE
  // ======================================================
  for (let fileIndex = 0; fileIndex < results.length; fileIndex++) {
    const fileData = results[fileIndex];

    const originalBase = getBaseName(fileData.name);
    const providedBase = parseWithSpasi(fileNameRawInput);

    const baseNameToUse = providedBase ? providedBase : originalBase;


    // ================================
    // CASE 1 — TIDAK SPLIT
    // ================================
    if (!contactsPerFile) {
      let vcfContent = "";
      let localCounter = 1;

      fileData.lines.forEach((rawNum) => {
        const formatted = formatPhoneNumber(rawNum.trim());
        if (!formatted) return;

        let contactName = "";

        if (useCustomName) {
          contactName = `${parseWithSpasi(nameBaseInput)} ${baseNameToUse}${parseWithSpasi(additionalFileNameRaw)} ${localCounter}`.trim();
        } else {
          contactName = nameBaseInput ? `${parseWithSpasi(nameBaseInput)} ${localCounter}` : `kontak ${localCounter}`;
        }

        localCounter++;

        vcfContent += `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL:${formatted}\nEND:VCARD\n`;
      });

      const outFileName = `${originalBase}.vcf`;

      outputDiv.appendChild(downloadLink(outFileName, vcfContent));
      zip.file(outFileName, vcfContent);
      continue;
    }


    // ================================
    // CASE 2 — SPLIT PER FILE
    // ================================
    const lines = fileData.lines.filter(l => l);
    const chunks = [];

    for (let i = 0; i < lines.length; i += contactsPerFile) {
      chunks.push(lines.slice(i, i + contactsPerFile));
    }

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {

      const chunk = chunks[chunkIdx];
      let vcfContent = "";

      for (let idx = 0; idx < chunk.length; idx++) {

        const formatted = formatPhoneNumber(chunk[idx]);
        if (!formatted) continue;

        let contactName = "";

        if (useCustomName) {
          contactName =
            `${parseWithSpasi(nameBaseInput)} ${baseNameToUse}${parseWithSpasi(additionalFileNameRaw)} ${globalCounter}`.trim();
        } else {
          contactName =
            nameBaseInput ? `${parseWithSpasi(nameBaseInput)} ${globalCounter}` : `kontak ${globalCounter}`;
        }

        globalCounter++;

        vcfContent += `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL:${formatted}\nEND:VCARD\n`;
      }

      const outFileName = `${baseNameToUse}${chunkIdx + 1}.vcf`;
      outputDiv.appendChild(downloadLink(outFileName, vcfContent));
      zip.file(outFileName, vcfContent);
    }
  }


  // ======================================================
  // ZIP DOWNLOAD
  // ======================================================
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipLink = document.createElement("a");

  zipLink.href = URL.createObjectURL(zipBlob);
  zipLink.download = "all_split_vcf.zip";
  zipLink.textContent = `📦 Download Semua (all_split_vcf.zip)`;

  zipLink.style.display = "block";
  zipLink.style.marginTop = "20px";
  zipLink.style.fontWeight = "bold";

  outputDiv.appendChild(zipLink);
});


// ============================
// FUNGSI LINK DOWNLOAD
// ============================
function downloadLink(fileName, content) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type: "text/vcard" }));
  link.download = fileName;
  link.textContent = `Download ${fileName}`;
  return link;
}
