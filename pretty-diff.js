#!/usr/bin/env node

var fs = require("fs");
var path = require("path");
var os = require("os");
var open = require("open");
var diff = require("./diff");

var startsWith = function (str, search, rawPos) {
	var pos = rawPos > 0 ? rawPos | 0 : 0;
	return str.substring(pos, pos + search.length) === search;
}

var endsWith = function (str, search) {
	return str.indexOf(search, str.length - search.length) !== -1;;
}

diff(process.argv.slice(2).join(" "), function (error, parsedDiff) {
	if (error) {
		// Usage error, assume we're not in a git directory
		if (error.code === 129) {
			process.stderr.write("Error: Not a git repository\n");
			return;
		}

		process.stderr.write(error.message);
		return;
	}

	if (!parsedDiff) {
		console.log("No differences");
		return;
	}

	generatePrettyDiff(parsedDiff);
});

function generatePrettyDiff(parsedDiff) {
	var template = fs.readFileSync(__dirname + "/template.html", "utf8");
	var diffHtml = "";
	var tempPath = path.join(os.tmpdir(), "diff.html");

	for (var file in parsedDiff) {
		if (endsWith(file,".js"))
		diffHtml += "<h2>" + file + "</h2>" +
			"<div class='file-diff'><div>" +
			markUpDiff(parsedDiff[file]) +
			"</div></div>";
	}

	fs.writeFileSync(tempPath, template.replace("{{diff}}", diffHtml));
	open(tempPath);
}

var diffClasses = {
	"d": "file",
	"i": "file",
	"@": "info",
	"-": "delete",
	"+": "insert",
	" ": "context"
};

function escape(str) {
	return str
		.replace(/\$/g, "$$$$")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\t/g, "    ");
}

var markUpDiff = function (diff) {
	if (diff.indexOf("--- /dev/null") !== -1) {
		{
			return "";
		}
	};

	var dataDiff = [];
	var localDiff = [];

	var isRevCorrect = true;
	var isWaitClose = false;

  const newDiff =  diff
  .filter(line => {
    return !(line.trim() === "+" || line.trim() === "-");
  });

  newDiff.forEach(function (line, index) {
		var type = line.charAt(0);
		localDiff.push("<pre class='" + diffClasses[type] + "'>" + escape(line) + "</pre>");

		// Xóa trực tiếp
		//  && line === "\ No newline at end of file"
		if (startsWith(line, "-") && isWaitClose === false &&
			(
				newDiff[index + 1] === undefined ||
				(!startsWith(newDiff[index + 1], "+") && !startsWith(newDiff[index + 1], "-"))
			)) {
			isRevCorrect = false;
		}

		// Đầu thêm
		if (startsWith(line, "+") && !startsWith(newDiff[index - 1], "+")) {
      var regexRev = /\/\/\s*Rev\s*[0-9]{2}\.[0-9]{2}\.[0-9]{2}.*\s*s/g;
			if (!regexRev.test(line)) {
				isRevCorrect = false;
			}
			isWaitClose = true;
    }
    
    // Đầu end
		if (startsWith(line, "+") &&
			(
				newDiff[index + 1] === undefined ||
				!startsWith(newDiff[index + 1], "+")
			)) {
			// Đầu thêm đã bị lỗi => lỗi luôn
			if (isRevCorrect === false) {
				isWaitClose = false;
			} else {
        // Đầu thêm chưa bị lỗi
        var regexRev = /\/\/\s*Rev\s*[0-9]{2}\.[0-9]{2}\.[0-9]{2}.*\s*e/g;
        if (!regexRev.test(line)) {
          isRevCorrect = false;
        } else {
          localDiff = [];
        }
        isWaitClose = false;
      }
		}

		if (isRevCorrect === false && isWaitClose === false) {
			dataDiff = [...dataDiff, ...localDiff];
			isRevCorrect = true;
			localDiff = [];
		}
	});

  return dataDiff.join("\n");
};