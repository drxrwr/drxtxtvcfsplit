// Ganti § jadi spasi
function parseWithSpasi(text) {
  return (text || "").replace(/§/g, " ").trim();
}

// Tambah + jika tidak diawali + atau 0
function formatPhoneNumber(num) {
  if (!num) return "";
  num = num.trim();
  if (num.startsWith("+") || num.startsWith("0")) return num;
  return "+" + num;
}

// Tambahkan padding nol di depan nomor (tidak diubah dari aslinya, disediakan jika dibutuhkan)
function padNumber(num, totalLength) {
  return num.toString().padStart(totalLength, "0");
}

function getBaseName(filename) {
  // hapus ekstensi terakhir
  return filename.replace(/\.[^/.]+$/, "");
}

// ====================
// Ekstraksi nomor dari teks (untuk VCF atau teks yang mengandung label)
// Kita cari potongan yang mengandung minimal 10 digit (boleh ada + di depan)
// ====================
function extractNumbersFromText(text) {
  if (!text) return [];
  const matches = [];
  // cari segmen yang dimulai dengan digit atau + dan mengandung minimal 10 karakter angka total (boleh ada spasi/()-)
  const regex = /[+\d][\d\-\s().]{9,}/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    let candidate = m[0];
    // bersihkan: biarkan leading + kalau ada, lalu ambil hanya digit sisanya
    let hasPlus = candidate.trim().startsWith("+");
    // remove non-digits
    let digitsOnly = candidate.replace(/[^\d]/g, "");
    // pastikan minimal 10 digit
    if (digitsOnly.length >= 10) {
      const cleaned = hasPlus ? `+${digitsOnly}` : digitsOnly;
      matches.push(cleaned);
    }
  }
  return matches;
}

// ====================
// Upload & Drag/Drop
// ====================
const uploadArea = document.getElementById("uploadArea");
const txtFileInput = document.getElementById("txtFileInput");
const fileListDiv = document.getElementById("fileList");
let uploadedFiles = [];

// Klik area → buka file chooser
uploadArea.addEventListener("click", () => txtFileInput.click());

// Drag & Drop visual & handler
uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});
uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("dragover"));
uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});
txtFileInput.addEventListener("change", () => handleFiles(txtFileInput.files));

function handleFiles(files) {
  // convert FileList to Array and append
  uploadedFiles = [...uploadedFiles, ...Array.from(files)];
  renderFileList();
  readAllFiles();
}

function renderFileList() {
  fileListDiv.innerHTML = uploadedFiles
    .map((f, i) => `<div data-index="${i}">${f.name}</div>`)
    .join("");

  // aktifkan drag & drop sorting menggunakan SortableJS
  new Sortable(fileListDiv, {
    animation: 150,
    onEnd: () => {
      // reorder uploadedFiles sesuai order di DOM
      const newOrder = [];
      fileListDiv.querySelectorAll("div").forEach((el) => {
        const name = el.textContent;
        const found = uploadedFiles.find(f => f.name === name);
        if (found) newOrder.push(found);
      });
      uploadedFiles = newOrder;
      fileListDiv.innerHTML = uploadedFiles
        .map((f, i) => `<div data-index="${i}">${f.name}</div>`)
        .join("");
      readAllFiles();
    },
  });
}

function readAllFiles() {
  if (!uploadedFiles.length) {
    document.getElementById("numberTextArea").value = "";
    document.getElementById("totalNumberInfo").innerText = `Total nomor: 0`;
    return;
  }

  let totalNumbers = 0;
  const readers = uploadedFiles.map((file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result || "";
        // jika file adalah VCF -> ekstrak nomor dari seluruh teks
        if (file.name.toLowerCase().endsWith(".vcf")) {
          const nums = extractNumbersFromText(content);
          totalNumbers += nums.length;
          resolve({ name: file.name, lines: nums });
          return;
        }
        // jika bukan VCF (misal .txt), ambil per baris (jaga format seperti sebelumnya)
        const lines = content
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l);
        totalNumbers += lines.length;
        resolve({ name: file.name, lines });
      };
      reader.readAsText(file);
    });
  });

  Promise.all(readers).then((results) => {
    const allNumbers = results.flatMap((r) => r.lines);
    document.getElementById("numberTextArea").value = allNumbers.join("\n");
    document.getElementById("totalNumberInfo").innerText = `Total nomor: ${totalNumbers}`;
  });
}

// ====================
// Split ke VCF
// ====================
document.getElementById("splitVCFButton").addEventListener("click", async function () {
  const rawNumbers = document.getElementById("numberTextArea").value.trim();
  const nameBaseInput = document.getElementById("contactNameInput").value.trim();
  let contactsPerFileInput = document.getElementById("contactsPerFile").value;
  // parse contactsPerFile: if empty or <=0 => no-split behavior
  let contactsPerFile = parseInt(contactsPerFileInput);
  if (isNaN(contactsPerFile) || contactsPerFile <= 0) contactsPerFile = null;

  const startNumberRaw = document.getElementById("startNumberInput").value;
  // startNumber is optional in UI; if empty we'll default to 1 when used
  let startNumber = parseInt(startNumberRaw);
  const fileNameRawInput = document.getElementById("splitFileNameInput").value;
  const additionalFileNameRaw = document.getElementById("additionalFileNameInput").value;
  const useCustomName = document.getElementById("customNameCheckbox").checked;

  if (!rawNumbers && uploadedFiles.length === 0) {
    alert("Isi daftar nomor tidak boleh kosong atau upload file dulu.");
    return;
  }

  // Build fileSources: if uploadedFiles exist, use them; else synthetic "pasted"
  const fileSources = uploadedFiles.length ? uploadedFiles : [{ name: "pasted.txt", isSynthetic: true }];

  // For each file, get numbers array. For .vcf we already extracted in readAllFiles, but here re-read for safety.
  const results = await Promise.all(
    fileSources.map((file) => {
      return new Promise((resolve) => {
        if (file.isSynthetic) {
          const lines = rawNumbers
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l);
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
          const lines = content
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l);
          resolve({ name: file.name, lines });
        };
        reader.readAsText(file);
      });
    })
  );

  const outputDiv = document.getElementById("splitVcfFiles");
  outputDiv.innerHTML = "";
  const zip = new JSZip();

  // If startNumber is NaN (not provided) we'll default to 1 only when used (i.e., when splitting)
  if (isNaN(startNumber)) startNumber = null;

  for (let fileIndex = 0; fileIndex < results.length; fileIndex++) {
    const fileData = results[fileIndex];
    const originalBase = getBaseName(fileData.name);
    // Determine base name to use for output files: if user provided splitFileNameInput, use it; otherwise use originalBase
    const providedBase = parseWithSpasi(fileNameRawInput);
    const baseNameToUse = providedBase ? providedBase : originalBase;

    // If contactsPerFile is null => no split: make a single file per source with name = originalBase (and .vcf)
    if (!contactsPerFile) {
      // Prepare VCF content from all lines (format numbers first)
      let vcfContent = "";
      let contactCounter = 0;
      fileData.lines.forEach((rawNum, idx) => {
        const formatted = formatPhoneNumber(rawNum.trim());
        if (!formatted) return;
        contactCounter++;
        // build contact name
        let contactName = "";
        if (useCustomName) {
          // when custom name is active, combine nameBaseInput + baseNameToUse + additional + idx+1
          contactName = `${parseWithSpasi(nameBaseInput)} ${baseNameToUse}${parseWithSpasi(additionalFileNameRaw)} ${idx + 1}`.trim();
        } else {
          contactName = nameBaseInput ? `${parseWithSpasi(nameBaseInput)} ${contactCounter}` : `kontak ${contactCounter}`;
        }
        vcfContent += `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL:${formatted}\nEND:VCARD\n`;
      });

      // filename: keep original base name (not the provided base name) per requirement
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

    // Jika di sini => contactsPerFile terisi, maka lakukan chunking
    const lines = fileData.lines.map(l => l.trim()).filter(l => l);
    const chunks = [];
    for (let i = 0; i < lines.length; i += contactsPerFile) {
      chunks.push(lines.slice(i, i + contactsPerFile));
    }

    // startNumber default 1 jika user tidak mengisi
    const effectiveStart = (startNumber === null) ? 1 : startNumber;

    // buat file per chunk
    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      let vcfContent = "";
      for (let idx = 0; idx < chunk.length; idx++) {
        const rawNum = chunk[idx];
        const formatted = formatPhoneNumber(rawNum.trim());
        if (!formatted) continue;
        // contact name logic
        let contactName = "";
        if (useCustomName) {
          // local idx per chunk
          const localIdx = idx + 1;
          contactName = `${parseWithSpasi(nameBaseInput)} ${baseNameToUse}${effectiveStart + chunkIdx}${parseWithSpasi(additionalFileNameRaw)} ${localIdx}`.trim();
        } else {
          // global numbering across this file's chunks only: we can compute global index = effectiveStart + chunkIdx*contactsPerFile + idx
          const globalIndex = effectiveStart + chunkIdx * contactsPerFile + idx;
          contactName = nameBaseInput ? `${parseWithSpasi(nameBaseInput)} ${globalIndex}` : `kontak ${globalIndex}`;
        }
        vcfContent += `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL:${formatted}\nEND:VCARD\n`;
      }

      // Nama file untuk chunk:
      // Jika user mengisi splitFileNameInput -> gunakan itu sebagai base; jika kosong -> gunakan originalBase.
      // Tambahkan nomor: base + (effectiveStart + chunkIdx)
      const splitBase = baseNameToUse;
      const fileNumberPart = effectiveStart + chunkIdx;
      const outFileName = `${splitBase}${fileNumberPart}.vcf`;

      const blob = new Blob([vcfContent], { type: "text/vcard" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = outFileName;
      link.textContent = `Download ${link.download}`;
      outputDiv.appendChild(link);
      outputDiv.appendChild(document.createElement("br"));

      zip.file(outFileName, vcfContent);
    }
  }

  // buat ZIP berisi semua file yang dibuat (jika ada)
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
