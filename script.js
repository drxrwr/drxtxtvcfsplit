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

  if (!rawNumbers && uploadedFiles.length === 0) {
    alert("Isi daftar nomor tidak boleh kosong atau upload file dulu.");
    return;
  }

  const fileSources = uploadedFiles.length ? uploadedFiles : [{ name: "pasted.txt", isSynthetic: true }];

  const results = await Promise.all(
    fileSources.map((file) => {
      return new Promise((resolve) => {
        if (file.isSynthetic) {
          const lines = rawNumbers.split(/\r?\n/).map((l) => l.trim()).filter((l) => l);
          resolve({ name: file.name, lines });
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target.result || "";
          if (file.name.toLowerCase().endsWith(".vcf")) {
            const nums = extractNumbersFromText(content);
            resolve({ name: file.name, lines: nums });
            return;
          }
          const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l);
          resolve({ name: file.name, lines });
        };
        reader.readAsText(file);
      });
    })
  );

  const outputDiv = document.getElementById("splitVcfFiles");
  outputDiv.innerHTML = "";
  const zip = new JSZip();

  // ================================
  // FIX: GLOBAL COUNTER (tidak reset)
  // ================================
  let globalCounter;
  if (isNaN(startNumber)) {
    globalCounter = 1;
  } else {
    globalCounter = startNumber;
  }

  // =====================================
  // LOOP FILE (globalCounter tidak reset!)
  // =====================================
  for (let fileIndex = 0; fileIndex < results.length; fileIndex++) {
    const fileData = results[fileIndex];
    const originalBase = getBaseName(fileData.name);
    const providedBase = parseWithSpasi(fileNameRawInput);
    const baseNameToUse = providedBase ? providedBase : originalBase;

    // ==========================
    // CASE 1 → TIDAK SPLIT
    // ==========================
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
      const blob = new Blob([vcfContent], { type: "text/vcard" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = outFileName;
      link.textContent = `Download ${link.download}`;
      outputDiv.appendChild(link);
      outputDiv.appendChild(document.createElement("br"));

      zip.file(outFileName, vcfContent);
      continue;
    }

    // ==========================
    // CASE 2 → SPLIT PER FILE
    // ==========================
    const lines = fileData.lines.map(l => l.trim()).filter(l => l);
    const chunks = [];
    for (let i = 0; i < lines.length; i += contactsPerFile) {
      chunks.push(lines.slice(i, i + contactsPerFile));
    }

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      let vcfContent = "";

      for (let idx = 0; idx < chunk.length; idx++) {
        const formatted = formatPhoneNumber(chunk[idx].trim());
        if (!formatted) continue;

        let contactName = "";

        if (useCustomName) {
          contactName = `${parseWithSpasi(nameBaseInput)} ${baseNameToUse}${parseWithSpasi(additionalFileNameRaw)} ${globalCounter}`.trim();
        } else {
          contactName = nameBaseInput
            ? `${parseWithSpasi(nameBaseInput)} ${globalCounter}`
            : `kontak ${globalCounter}`;
        }

        globalCounter++;

        vcfContent += `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL:${formatted}\nEND:VCARD\n`;
      }

      const outFileName = `${baseNameToUse}${chunkIdx + 1}.vcf`;

      zip.file(outFileName, vcfContent);

      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([vcfContent], { type: "text/vcard" }));
      link.download = outFileName;
      link.textContent = `Download ${link.download}`;
      outputDiv.appendChild(link);
      outputDiv.appendChild(document.createElement("br"));
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipLink = document.createElement("a");
  zipLink.href = URL.createObjectURL(zipBlob);
  zipLink.download = `all_split_vcf.zip`;
  zipLink.textContent = `📦 Download Semua (${zipLink.download})`;
  zipLink.style.fontWeight = "bold";
  zipLink.style.display = "block";
  zipLink.style.marginTop = "20px";
  outputDiv.appendChild(zipLink);
});
