const puppeteer = require('puppeteer');
const log = require('./js/log.js');

async function startTicketing(consertId, day, userId, pw, browser) {
    const page = await browser.newPage();
    await page.goto('https://ticket.interpark.com/Gate/TPLogin.asp');

    await page.setViewport({ width: 1080, height: 1024 });
    await page.waitForSelector('iframe');
    const id = await page.$(
        'iframe[src="https://accounts.interpark.com/authorize/ticket-pc?origin=https%3A%2F%2Fticket%2Einterpark%2Ecom%2FGate%2FTPLoginConfirmGate%2Easp%3FGroupCode%3D%26Tiki%3D%26Point%3D%26PlayDate%3D%26PlaySeq%3D%26HeartYN%3D%26TikiAutoPop%3D%26BookingBizCode%3D%26MemBizCD%3DWEBBR%26CPage%3D%26GPage%3Dhttp%253A%252F%252Fticket%252Einterpark%252Ecom%252F&postProc=IFRAME"]'
    );

    // 로그인
    const idSelector = '#userId';
    const idInput = userId;
    const pwSelector = '#userPwd';
    const pwInput = pw;

    let frame = await id.contentFrame();
    await frame.type(idSelector, idInput);
    await frame.type(pwSelector, pwInput);
    await page.keyboard.press('Enter');
    await log.addLog("로그인 성공");

    // 로그인 성공 후 페이지 로드 확인
    await page.waitForNavigation();
    await log.addLog("페이지 로드 완료");

    // 야구경기
    let consertUrl = 'https://ticket.interpark.com/Contents/Sports/' + consertId;
    console.log('Navigating to:', consertUrl);
    await page.goto(consertUrl);
    await log.addLog("야구경기 페이지 이동");

    // 팝업 닫기
    const popupSelector = '#div_checkDontsee_PT002_4_1';
    const closeBtnSelector = 'button.btn.btnClose';

    try {
        await page.waitForSelector(popupSelector, { timeout: 5000 });
        const closeButton = await page.$(closeBtnSelector);
        if (closeButton) {
            await closeButton.click();
            await log.addLog("팝업 닫기 성공");
        }
    } catch (e) {
        await log.addLog("팝업 없음 또는 닫기 실패");
    }

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // 날짜 선택하기
    const ticketSelector = '.timeScheduleList';
    await page.waitForSelector(ticketSelector);
    await log.addLog("날짜 선택 리스트 로드 완료");

    // 날짜가 포함된 요소 선택
    const days = await page.$$('.timeSchedule');
    let targetDayElement = null;

    await log.addLog("날짜 요소 로드 완료, 총 " + days.length + "개의 날짜 요소 발견");

    for (let dayElement of days) {
        const dateComponents = await dayElement.$$eval('.scheduleDate .num', elements =>
            elements.map(el => el.classList.contains('dot') ? '-' : el.className.match(/num(\d)/)[1]).join('')
        );
        const dateText = dateComponents.split('-').join(''); // format: MMDD
        const targetDateText = day.split('-').join(''); // 매개변수로 받은 day를 MMDD 형식으로 변경

        await log.addLog("날짜 비교: " + dateText + " vs " + targetDateText);

        if (dateText === targetDateText) {
            targetDayElement = dayElement;
            await log.addLog("해당 날짜 요소 발견: " + dateText);
            break;
        }
    }

    if (targetDayElement) {
        const bookingButton = await targetDayElement.$('.btns .BtnColor_Y');
        if (bookingButton) {
            // 팝업 이벤트를 먼저 기다리도록 설정합니다.
            const newPagePromise = new Promise(resolve => page.once('popup', target => resolve(target)));
            await bookingButton.click();
            await log.addLog('해당 날짜의 예매 버튼을 성공적으로 눌렀습니다.');

            // 팝업 페이지가 열렸는지 확인
            try {
                const popupPage = await newPagePromise;
                await log.addLog("팝업 페이지 열림");

                // 팝업 페이지에서 올바른 프레임 찾기
                await popupPage.waitForSelector('#ifrmSeat');
                const frameHandle = await popupPage.$('#ifrmSeat');
                const frame = await frameHandle.contentFrame();

                // 구역 클릭
                const seatSelector = 'a[sgn="1루 4층지정석(홈팀)"]';
                await frame.waitForSelector(seatSelector);
                await frame.click(seatSelector);
                await log.addLog("지정석 선택완료.");

                // 구역 선택 버튼 클릭
                const selectButtonSelector = '.twoBtn a:last-child';
                await frame.waitForSelector(selectButtonSelector);
                await frame.click(selectButtonSelector);
                await log.addLog("좌석 선택 버튼 클릭 완료");

                // 좌석 선택
                const iframeDetailHandle = await frame.waitForSelector('#ifrmSeatDetail');
                const detailFrame = await iframeDetailHandle.contentFrame();
                const seat1 = 'img[title="[1루 4층지정석(홈팀)] 408구역 Q열-2"]';
                const seat2 = 'img[title="[1루 4층지정석(홈팀)] 408구역 Q열-1"]';
                const seat3 = 'img[title="[1루 4층지정석(홈팀)] 408구역 R열-2"]';
                const seat4 = 'img[title="[1루 4층지정석(홈팀)] 408구역 R열-1"]';
                await detailFrame.waitForSelector(seat1);
                await detailFrame.click(seat1);
                await detailFrame.waitForSelector(seat2);
                await detailFrame.click(seat2);
                await detailFrame.waitForSelector(seat3);
                await detailFrame.click(seat3);
                await detailFrame.waitForSelector(seat4);
                await detailFrame.click(seat4);
                await log.addLog("좌석선택 완료");

                // 좌석 선택 완료 버튼 클릭을 위해 다시 메인 프레임으로 돌아옴
                await popupPage.bringToFront();
                await frame.waitForSelector('#NextStepImage');
                await frame.click('#NextStepImage');
                await log.addLog("좌석 선택 완료 버튼 클릭 완료");
            } catch (error) {
                await log.addErrorLog("팝업 페이지 열기에 실패했습니다. 에러: " + error.message);
            }
        } else {
            await log.addErrorLog("해당 날짜에 예매하기 버튼을 찾지 못했습니다.");
            return;
        }
    } else {
        await log.addErrorLog("해당 날짜를 찾지 못했습니다.");
        return;
    }

    await sleep(5000); // sleep 함수 호출에 await 추가
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// 특정 시간에 시작하도록 설정하는 함수
async function scheduleStart(consertId, day, userId, pw, startTime) {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--disable-web-security', '--disable-features=IsolateOrigins', '--disable-site-isolation-trials']
    });

    await log.addLog("브라우저를 성공적으로 띄웠습니다.");

    const now = new Date();
    const targetTime = new Date(startTime);
    let timeDifference = getTimeDifference(now, targetTime);

    if (timeDifference <= 0) {
        await log.addLog("지정된 시간이 이미 지났습니다. 티켓팅을 바로 시작합니다.");
        await startTicketing(consertId, day, userId, pw, browser);
    } else {
        // 남은 시간 카운트다운 로그
        const interval = setInterval(() => {
            timeDifference -= 1000;
            if (timeDifference <= 0) {
                clearInterval(interval);
            } else {
                const seconds = Math.floor((timeDifference / 1000) % 60);
                const minutes = Math.floor((timeDifference / (1000 * 60)) % 60);
                const hours = Math.floor((timeDifference / (1000 * 60 * 60)) % 24);
                const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
                log.addLog(`남은 시간: ${days}일 ${hours}시간 ${minutes}분 ${seconds}초`);
            }
        }, 1000);

        setTimeout(async () => {
            clearInterval(interval);
            await startTicketing(consertId, day, userId, pw, browser);
        }, timeDifference);
    }
}

// 현재 시간과 목표 시간의 차이를 밀리초 단위로 계산하는 함수
function getTimeDifference(currentTime, targetTime) {
    return targetTime - currentTime;
}

module.exports = { startTicketing, scheduleStart };
