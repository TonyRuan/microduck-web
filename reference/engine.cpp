#include "engine.h"
#include <algorithm>
#include <cmath>
#include <stdexcept>

using Clock = std::chrono::steady_clock;
static constexpr const char* names[] = {"left_hip_yaw","left_hip_roll","left_hip_pitch","left_knee","left_ankle",
    "neck_pitch","head_pitch","head_yaw","head_roll","mouth","right_hip_yaw","right_hip_roll","right_hip_pitch","right_knee","right_ankle"};
static constexpr double home[] = {0,-.0873,-.4579,-.0049,.4530,.3491,.3491,0,0,0,0,.0873,.4579,.0049,-.4530};

Engine::Engine(const std::string& directory, int profile):directory(directory) {
    char message[2048] = {};
    model = mj_loadXML((directory+"/scene.xml").c_str(), nullptr, message, sizeof(message));
    if (!model) throw std::runtime_error(message);
    data = mj_makeData(model);
    if (!data) { mj_deleteModel(model); model=nullptr; throw std::runtime_error("Unable to allocate physics state"); }
    try {
        model->opt.timestep = .005;
        for(int i=0;i<15;i++) {
            actuators[i]=mj_name2id(model,mjOBJ_ACTUATOR,names[i]);
            int j=mj_name2id(model,mjOBJ_JOINT,names[i]);
            if (i!=9 && (actuators[i]<0 || j<0)) throw std::runtime_error(std::string("Missing joint: ")+names[i]);
            qpos[i]=j<0?-1:model->jnt_qposadr[j]; qvel[i]=j<0?-1:model->jnt_dofadr[j];
            gains[i]=actuators[i]<0?0:model->actuator_gainprm[actuators[i]*mjNGAIN];
        }
        int j=mj_name2id(model,mjOBJ_JOINT,"trunk_base_freejoint");
        if(j<0) throw std::runtime_error("Missing trunk");
        trunk=model->jnt_qposadr[j]; trunkDof=model->jnt_dofadr[j];
        j=mj_name2id(model,mjOBJ_JOINT,"football_free");
        if(j<0) throw std::runtime_error("Missing ball");
        ballPos=model->jnt_qposadr[j]; ballDof=model->jnt_dofadr[j];
        resetLocked(profile);
    } catch(...) { mj_deleteData(data); mj_deleteModel(model); data=nullptr; model=nullptr; throw; }
}
Engine::~Engine() {
    running=false;
    if(worker.joinable()) worker.join();
    duck_mobile_destroy(control);
    if(data) mj_deleteData(data);
    if(model) mj_deleteModel(model);
}
void Engine::resetLocked(int profile) {
    MobileControl* next=duck_mobile_create((directory+"/policies").c_str(),profile);
    if(!next) throw std::runtime_error("Policy bundle could not be loaded");
    duck_mobile_destroy(control); control=next;
    mj_resetData(model,data);
    data->qpos[trunk+2]=.125;
    data->qpos[trunk+3]=1;
    for(int i=0;i<15;i++) if(actuators[i]>=0) {
        data->qpos[qpos[i]]=home[i]; data->ctrl[actuators[i]]=home[i];
        model->actuator_gainprm[actuators[i]*mjNGAIN]=gains[i];
        model->actuator_biasprm[actuators[i]*mjNBIAS+1]=-gains[i];
    }
    vx=yaw=busy=seated=fallSeconds=0; fallen=false; error.clear();
    lastInput=Clock::now();
    ballLocked(); mj_forward(model,data);
}
void Engine::reset(int profile) { std::lock_guard guard(mutex); resetLocked(profile); }
void Engine::ballLocked() {
    // Place a real dynamic ball ahead and to the duck's right; do not move the duck.
    double rot[9]; mju_quat2Mat(rot,data->qpos+trunk+3);
    data->qpos[ballPos]=data->qpos[trunk]+rot[0]*.22-rot[1]*.045;
    data->qpos[ballPos+1]=data->qpos[trunk+1]+rot[3]*.22-rot[4]*.045;
    data->qpos[ballPos+2]=.026;
    data->qpos[ballPos+3]=1;
    std::fill(data->qpos+ballPos+4,data->qpos+ballPos+7,0.);
    std::fill(data->qvel+ballDof,data->qvel+ballDof+6,0.);
}
void Engine::ball() { std::lock_guard guard(mutex); ballLocked(); mj_forward(model,data); }
void Engine::move(double x,double z) {
    std::lock_guard guard(mutex);
    vx=std::isfinite(x)?std::clamp(x,-.4,.4):0; yaw=std::isfinite(z)?std::clamp(z,-1.,1.):0;
    lastInput=Clock::now();
}
int Engine::action(int id) {
    std::lock_guard guard(mutex); vx=yaw=0;
    if(paused || fallen || !error.empty()) return 1;
    return duck_mobile_action(control,id);
}
void Engine::pause(bool p) { std::lock_guard guard(mutex); paused=p; vx=yaw=0; lastInput=Clock::now(); }
void Engine::tickLocked() {
    if(paused || !error.empty()) return;
    auto begin=Clock::now();
    if(std::chrono::duration<double>(begin-lastInput).count()>.25) vx=yaw=0;
    double sensors[40]={}, out[18]={}, rot[9];
    for(int i=0;i<15;i++) if(qpos[i]>=0) { sensors[i]=data->qpos[qpos[i]]; sensors[15+i]=data->qvel[qvel[i]]; }
    std::copy(data->qvel+trunkDof+3,data->qvel+trunkDof+6,sensors+30);
    mju_quat2Mat(rot,data->qpos+trunk+3);
    sensors[33]=-rot[6]; sensors[34]=-rot[7]; sensors[35]=-rot[8];
    std::copy(data->qpos+trunk+3,data->qpos+trunk+7,sensors+36);
    if(!busy && sensors[35]>-.35) fallSeconds+=.02; else fallSeconds=0;
    if(fallSeconds>.8) { fallen=true; vx=yaw=0; }
    if(!fallen) {
        if(duck_mobile_step(control,sensors,vx,yaw,out)!=0) { error="Policy inference failed"; vx=yaw=0; return; }
        busy=out[16]; seated=out[17];
        for(int i=0;i<15;i++) if(actuators[i]>=0) {
            data->ctrl[actuators[i]]=out[i];
            model->actuator_gainprm[actuators[i]*mjNGAIN]=gains[i]*out[15]/200.;
            model->actuator_biasprm[actuators[i]*mjNBIAS+1]=-gains[i]*out[15]/200.;
        }
    } else for(int i=0;i<15;i++) if(actuators[i]>=0) {
        model->actuator_gainprm[actuators[i]*mjNGAIN]=gains[i]*.1;
        model->actuator_biasprm[actuators[i]*mjNBIAS+1]=-gains[i]*.1;
    }
    for(int n=0;n<4;n++) mj_step(model,data);
    totalSimTime += .02;
    for(int i=0;i<model->nq;i++) if(!std::isfinite(data->qpos[i])) {error="Non-finite physics state"; break;}
    const double elapsed=std::chrono::duration<double,std::milli>(Clock::now()-begin).count();
    ms=ms==0?elapsed:ms*.95+elapsed*.05;
}
void Engine::tick() { std::lock_guard guard(mutex); tickLocked(); }
void Engine::start() {
    if(running.exchange(true)) return;
    worker=std::thread([this]{
        auto next=Clock::now(), sample=next; double previousTime=0;
        while(running) {
            { std::lock_guard guard(mutex); tickLocked();
              auto now=Clock::now(); double wall=std::chrono::duration<double>(now-sample).count();
              if(wall>=1) { hz=(totalSimTime-previousTime)/(.02*wall); previousTime=totalSimTime; sample=now; }
            }
            next+=std::chrono::milliseconds(20);
            if(Clock::now()-next>std::chrono::milliseconds(250)) next=Clock::now();
            std::this_thread::sleep_until(next);
        }
    });
}
std::array<double,14> Engine::state() {
    std::lock_guard guard(mutex);
    return {data->time,data->qpos[trunk],data->qpos[trunk+1],data->qpos[trunk+2],busy,seated,fallen?1.:0.,paused?1.:0.,ms,hz,vx,yaw,data->qpos[ballPos],data->qpos[ballPos+1]};
}
