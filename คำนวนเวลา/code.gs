function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('เครื่องคำนวณเวลา - จิมมี่')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}